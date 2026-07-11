import Header from "@/components/Header";
import WelcomeSection from "@/components/WelcomeSection";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import ListingsCarousel from "@/components/ListingsCarousel";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <WelcomeSection />
        <Features />
        <ListingsCarousel/> 
      </main>
      <Footer />
    </div>
  );
};

export default Index;
