import type { Metadata } from "next";
import { Admin } from "@/components/admin";

export const metadata: Metadata = {
  title: "Manage the board · Morning weight",
};

export default function AdminPage() {
  return <Admin />;
}
