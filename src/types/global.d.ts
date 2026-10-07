import type React from "react";

declare global {
  type PageProps<T extends string = string> = {
    params: Promise<any>;
    searchParams: Promise<any>;
  };

  type LayoutProps<T extends string = string> = {
    children: React.ReactNode;
    params: Promise<any>;
  };
}

export {};
