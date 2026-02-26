export default function SectionTitle({
  index,
  max,
  title,
}: {
  index: number;
  max: number;
  title: string;
}) {
  return (
    <div className="container -mt-1 pointer-events-none select-none relative">
      <div className="h-92 lg:h-140 relative">
        <div className="h-1 bottom-0 absolute left-0 w-full bg-border-faint" />
        <div className="h-1 top-0 absolute w-screen left-[calc(50%-50vw)] bg-border-faint" />
      </div>

      <div className="relative grid lg:grid-cols-2 -mt-1">
        <div className="h-1 bottom-0 absolute w-screen left-[calc(50%-50vw)] bg-border-faint" />

        <div className="flex gap-40 py-24 lg:py-45 relative">
          <div className="h-full w-1 right-0 top-0 bg-border-faint absolute lg-max:hidden" />
          <div className="w-2 h-16 bg-black" />

          <div className="flex gap-12 items-center !text-mono-x-small text-gray-400 font-mono">
            <div>
              [{" "}
              <span className="text-black">
                {index.toString().padStart(2, "0")}
              </span>{" "}
              / {max.toString().padStart(2, "0")} ]
            </div>

            <div className="w-8 text-center">·</div>

            <div className="uppercase text-gray-600">{title}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
