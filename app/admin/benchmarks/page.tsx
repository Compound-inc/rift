import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin-auth";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";
import { BenchmarksTable } from "./BenchmarksTable";

export const metadata: Metadata = {
  title: "Benchmark Results",
  description: "Performance benchmarks for AI models.",
};

// Force dynamic rendering since we need to access headers for authentication
export const dynamic = 'force-dynamic';

export default async function BenchmarksPage() {
  // Check if user is admin
  const userIsAdmin = await isAdmin();
  
  if (!userIsAdmin) {
    // Redirect non-admin users to chat page
    redirect("/chat");
  }

  return (
    <div className="min-h-screen bg-background text-foreground mt-20">
      <Navbar />
      <main className="container mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Benchmark Results</h1>
          <p className="text-muted-foreground">
            Displaying performance metrics for Light, Standard, and Worse scenarios. 
            Click column headers to sort. Costs are adjusted based on premium status (×100 for premium, ×1000 for standard).
          </p>
        </div>

        <BenchmarksTable />
      </main>
      <Footer />
    </div>
  );
}

