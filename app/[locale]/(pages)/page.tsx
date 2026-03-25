import Header from "@/components/shared/header";
import HeroContent from "@/components/shared/hero-content";
import FeaturesGrid from "@/components/shared/features-grid";
import HowItWorksSection from "@/components/shared/how-it-works-section";
import TechStackSection from "@/components/shared/tech-stack-section";
import Footer from "@/components/shared/footer";

/**
 * Landing page - Trang giới thiệu đồ án tốt nghiệp
 *
 * Sections: Hero → Features → HowItWorks → TechStack → Footer
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroContent />
      <FeaturesGrid />
      <HowItWorksSection />
      <TechStackSection />
      <Footer />
    </div>
  )
}
