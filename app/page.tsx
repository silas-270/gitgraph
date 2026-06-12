import GraphPainter from "./components/GraphPainter";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-[#050505] font-sans py-12 px-4 sm:px-6 lg:px-8">
      <main className="max-w-7xl mx-auto flex flex-col items-center justify-center">
        <GraphPainter />
      </main>
    </div>
  );
}
