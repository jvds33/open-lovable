import { Fragment } from "react";

import Button from "@/components/ui/shadcn/button";
import HeaderGithubClient from "@/components/shared/header/Github/GithubClient";
import { NAV_ITEMS } from "@/components/shared/header/Nav/Nav";

import HeaderDropdownMobileItem from "./Item/Item";
import Link from "next/link";

export default function HeaderDropdownMobile({
  ctaHref = "/signin/signup",
  ctaLabel = "Sign up",
}: {
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="container relative">
      <div className="overlay border-x pointer-events-none border-border-faint" />

      <div>
        {NAV_ITEMS.map((item) => (
          <Fragment key={item.label}>
            <HeaderDropdownMobileItem item={item} />
          </Fragment>
        ))}
      </div>

      <div className="p-24 flex flex-col gap-8 border-b border-border-faint relative -mt-1">
        <HeaderGithubClient />
        <Link href={ctaHref}>
          <Button variant="secondary"> {ctaLabel} </Button>
        </Link>
      </div>

      <div className="h-36" />
    </div>
  );
}
