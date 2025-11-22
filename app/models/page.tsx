import { ModelsGrid } from "@/components/landing/models-grid";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";

export default function ModelsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-24 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">Modelos Disponibles</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Explora nuestra extensa biblioteca de modelos de inteligencia artificial.
            Desde modelos de razonamiento avanzado hasta modelos especializados en código y creatividad.
          </p>
        </div>
        <ModelsGrid />
      </main>
      <Footer />
    </div>
  );
}
