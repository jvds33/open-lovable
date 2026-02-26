import { DevboxRuntime, DevboxSDK } from 'devbox-sdk';
import { SandboxProvider, SandboxInfo, CommandResult } from '../types';
import { appConfig } from '@/config/app.config';

export class DevboxProvider extends SandboxProvider {
  private existingFiles: Set<string> = new Set();
  private sdk: DevboxSDK | null = null;
  private devbox: any = null;

  async createSandbox(): Promise<SandboxInfo> {
    try {
      // Kill existing sandbox if any
      if (this.devbox) {
        try {
          await this.devbox.delete();
        } catch (e) {
          console.error('[DevboxProvider] Failed to delete existing devbox:', e);
        }
        this.devbox = null;
      }

      // Close existing SDK if any
      if (this.sdk) {
        try {
          await this.sdk.close();
        } catch (e) {
          console.error('[DevboxProvider] Failed to close existing SDK:', e);
        }
        this.sdk = null;
      }

      // Clear existing files tracking
      this.existingFiles.clear();

      // Initialize SDK
      const kubeconfig = this.config.devbox?.kubeconfig || process.env.KUBECONFIG;
      const baseUrl = this.config.devbox?.baseUrl || process.env.DEVBOX_API_URL;

      if (!kubeconfig || !baseUrl) {
        throw new Error('KUBECONFIG and DEVBOX_API_URL environment variables are required');
      }

      this.sdk = new DevboxSDK({
        kubeconfig,
        baseUrl,
      });

      // Create devbox
      const devboxName = `sandbox-${Date.now()}`;
      const cpu = this.config.devbox?.cpu || appConfig.devbox.defaultCpu;
      const memory = this.config.devbox?.memory || appConfig.devbox.defaultMemory;

      this.devbox = await this.sdk.createDevbox({
        name: devboxName,
        runtime: DevboxRuntime.TEST_AGENT,
        resource: {
          cpu,
          memory,
        },
      });

      const sandboxId = this.devbox.name || devboxName;
      
      // Get devbox URL - assuming devbox has a url or domain property
      // If not available, we'll need to construct it or get it from the SDK
      let sandboxUrl = '';
      if (this.devbox.url) {
        sandboxUrl = this.devbox.url;
      } else if (this.devbox.domain) {
        sandboxUrl = `https://${this.devbox.domain}`;
      } else {
        // Fallback: construct URL from baseUrl and sandboxId
        sandboxUrl = `${baseUrl.replace('/api', '')}/${sandboxId}`;
      }

      this.sandboxInfo = {
        sandboxId,
        url: sandboxUrl,
        provider: 'devbox',
        createdAt: new Date(),
      };

      return this.sandboxInfo;

    } catch (error) {
      console.error('[DevboxProvider] Error creating sandbox:', error);
      throw error;
    }
  }

  async runCommand(command: string): Promise<CommandResult> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    try {
      // Parse command into cmd and args
      const parts = command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      // Check if devbox has exec or runCommand method
      // Based on common patterns, try exec first, then runCommand
      let result: any;
      
      if (typeof this.devbox.exec === 'function') {
        result = await this.devbox.exec({
          command: cmd,
          args: args,
          cwd: appConfig.devbox.workingDirectory,
        });
      } else if (typeof this.devbox.runCommand === 'function') {
        result = await this.devbox.runCommand({
          cmd: cmd,
          args: args,
          cwd: appConfig.devbox.workingDirectory,
        });
      } else {
        // Fallback: try to execute via shell
        const fullCommand = `${cmd} ${args.join(' ')}`;
        if (typeof this.devbox.exec === 'function') {
          result = await this.devbox.exec(fullCommand, {
            cwd: appConfig.devbox.workingDirectory,
          });
        } else {
          throw new Error('Devbox does not support command execution. exec or runCommand method not found.');
        }
      }

      // Handle result - adapt based on actual SDK response format
      let stdout = '';
      let stderr = '';
      let exitCode = 0;

      if (result) {
        if (typeof result.stdout === 'string') {
          stdout = result.stdout;
        } else if (result.output) {
          stdout = result.output;
        }

        if (typeof result.stderr === 'string') {
          stderr = result.stderr;
        } else if (result.error) {
          stderr = result.error;
        }

        if (typeof result.exitCode === 'number') {
          exitCode = result.exitCode;
        } else if (result.code !== undefined) {
          exitCode = result.code;
        }
      }

      return {
        stdout,
        stderr,
        exitCode,
        success: exitCode === 0,
      };
    } catch (error: any) {
      return {
        stdout: '',
        stderr: error.message || 'Command failed',
        exitCode: 1,
        success: false,
      };
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    const fullPath = path.startsWith('/') ? path : `${appConfig.devbox.workingDirectory}/${path}`;
    
    await this.devbox.writeFile(fullPath, content);
    this.existingFiles.add(path);
  }

  async readFile(path: string): Promise<string> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    const fullPath = path.startsWith('/') ? path : `${appConfig.devbox.workingDirectory}/${path}`;
    
    const content = await this.devbox.readFile(fullPath);
    
    // readFile returns Buffer, convert to string
    if (Buffer.isBuffer(content)) {
      return content.toString('utf-8');
    }
    
    return String(content);
  }

  async listFiles(directory: string = appConfig.devbox.workingDirectory): Promise<string[]> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    const files = await this.devbox.listFiles(directory);
    
    // Filter out node_modules, .git, etc.
    return files.filter((file: string) => {
      const normalizedPath = file.replace(directory, '').replace(/^\//, '');
      return !normalizedPath.includes('node_modules') &&
             !normalizedPath.includes('.git') &&
             !normalizedPath.includes('.next') &&
             !normalizedPath.includes('dist') &&
             !normalizedPath.includes('build');
    });
  }

  async installPackages(packages: string[]): Promise<CommandResult> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    const packageList = packages.join(' ');
    const flags = appConfig.packages.useLegacyPeerDeps ? '--legacy-peer-deps' : '';
    
    const command = flags 
      ? `npm install ${flags} ${packageList}`
      : `npm install ${packageList}`;

    const result = await this.runCommand(command);

    // Restart Vite if configured
    if (appConfig.packages.autoRestartVite && result.success) {
      await this.restartViteServer();
    }

    return result;
  }

  async setupViteApp(): Promise<void> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    // Create directory structure
    await this.runCommand(`mkdir -p ${appConfig.devbox.workingDirectory}/src`);

    // Create package.json
    const packageJson = {
      name: "sandbox-app",
      version: "1.0.0",
      type: "module",
      scripts: {
        dev: "vite --host",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@vitejs/plugin-react": "^4.0.0",
        vite: "^4.3.9",
        tailwindcss: "^3.3.0",
        postcss: "^8.4.31",
        autoprefixer: "^10.4.16"
      }
    };
    
    await this.writeFile('package.json', JSON.stringify(packageJson, null, 2));
    
    // Create vite.config.js
    const viteConfig = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: [
      '.vercel.run',
      '.e2b.dev',
      'localhost'
    ],
    hmr: false
  }
})`;
    
    await this.writeFile('vite.config.js', viteConfig);
    
    // Create tailwind.config.js
    const tailwindConfig = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}`;
    
    await this.writeFile('tailwind.config.js', tailwindConfig);
    
    // Create postcss.config.js
    const postcssConfig = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`;
    
    await this.writeFile('postcss.config.js', postcssConfig);
    
    // Create index.html
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sandbox App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`;
    
    await this.writeFile('index.html', indexHtml);
    
    // Create src/main.jsx
    const mainJsx = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;
    
    await this.writeFile('src/main.jsx', mainJsx);
    
    // Create src/App.jsx
    const appJsx = `function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center max-w-2xl">
        <p className="text-lg text-gray-400">
          Devbox Sandbox Ready<br/>
          Start building your React app with Vite and Tailwind CSS!
        </p>
      </div>
    </div>
  )
}

export default App`;
    
    await this.writeFile('src/App.jsx', appJsx);
    
    // Create src/index.css
    const indexCss = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
  background-color: rgb(17 24 39);
}`;
    
    await this.writeFile('src/index.css', indexCss);
    
    // Install dependencies
    try {
      const installResult = await this.runCommand(`cd ${appConfig.devbox.workingDirectory} && npm install`);
      
      if (installResult.exitCode !== 0) {
        console.warn('[DevboxProvider] npm install had issues:', installResult.stderr);
      }
    } catch (error: any) {
      console.error('[DevboxProvider] npm install error:', error);
      console.warn('[DevboxProvider] Continuing without npm install - packages may need to be installed manually');
    }
    
    // Start Vite dev server
    // Kill any existing Vite processes
    await this.runCommand(`pkill -f vite || true`);
    
    // Start Vite in background
    await this.runCommand(`cd ${appConfig.devbox.workingDirectory} && nohup npm run dev > /tmp/vite.log 2>&1 &`);
    
    // Wait for Vite to be ready
    await new Promise(resolve => setTimeout(resolve, appConfig.devbox.viteStartupDelay));
    
    // Track initial files
    this.existingFiles.add('src/App.jsx');
    this.existingFiles.add('src/main.jsx');
    this.existingFiles.add('src/index.css');
    this.existingFiles.add('index.html');
    this.existingFiles.add('package.json');
    this.existingFiles.add('vite.config.js');
    this.existingFiles.add('tailwind.config.js');
    this.existingFiles.add('postcss.config.js');
  }

  async restartViteServer(): Promise<void> {
    if (!this.devbox) {
      throw new Error('No active sandbox');
    }

    // Kill existing Vite process
    await this.runCommand(`pkill -f vite || true`);
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Start Vite in background
    await this.runCommand(`cd ${appConfig.devbox.workingDirectory} && nohup npm run dev > /tmp/vite.log 2>&1 &`);
    
    // Wait for Vite to be ready
    await new Promise(resolve => setTimeout(resolve, appConfig.devbox.viteStartupDelay));
  }

  getSandboxUrl(): string | null {
    return this.sandboxInfo?.url || null;
  }

  getSandboxInfo(): SandboxInfo | null {
    return this.sandboxInfo;
  }

  async terminate(): Promise<void> {
    if (this.devbox) {
      try {
        await this.devbox.delete();
      } catch (e) {
        console.error('[DevboxProvider] Failed to delete devbox:', e);
      }
      this.devbox = null;
    }

    if (this.sdk) {
      try {
        await this.sdk.close();
      } catch (e) {
        console.error('[DevboxProvider] Failed to close SDK:', e);
      }
      this.sdk = null;
    }

    this.sandboxInfo = null;
  }

  isAlive(): boolean {
    return !!this.devbox && !!this.sdk;
  }
}

