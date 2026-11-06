import type { Metadata } from "next";
import { poppins } from "./ui/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kanban | Your workspace",
  description: "A little space for your next big thing. Organize your tasks and keep work moving.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
