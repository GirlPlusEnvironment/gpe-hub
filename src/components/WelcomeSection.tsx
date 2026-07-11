import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import homepagePhoto from "@/assets/homepage_photo.jpeg";


const WelcomeSection = () => {
  return (
    <section
      id="about"
      className="w-full py-20 px-4 relative"
      style={{
        backgroundImage: `url(${homepagePhoto})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="absolute inset-0 bg-black/60"></div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-black/30"></div>

      {/* Content */}
      <div className="container mx-auto max-w-6xl relative z-10 text-center text-white space-y-8">
        {/* Heading + subheading */}
        <div className="space-y-4">
          <h1 className="text-4xl md:text-6xl font-bold text-primary leading-tight drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)]">
            Welcome to the GPE Community Hub!
          </h1>
          <p className="text-lg md:text-2xl text-white max-w-4xl mx-auto drop-shadow-[0_3px_6px_rgba(0,0,0,0.8)]">
            The central space for Black + Brown women+ to connect,
            learn, and gain access to climate and environmental jobs, funds, and resources
            to help find your place in the movement.
          </p>
        </div>

        {/* Accent divider */}
        <div className="h-1 w-24 bg-accent mx-auto rounded-full" />

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
            <Button
            asChild
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold uppercase tracking-wide shadow-lg shadow-black/40"
            >
            <Link to="/community">Join the Community</Link>
            </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold uppercase tracking-wide shadow-lg shadow-black/40"
          >
            <Link to="/explore">Explore Opportunities</Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default WelcomeSection;
