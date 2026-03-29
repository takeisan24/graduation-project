import dynamic from "next/dynamic";
import Header from "@/components/shared/header";
import HeroContent from "@/components/shared/hero-content";
import Footer from "@/components/shared/footer";

// Lazy load below-the-fold sections (not visible on initial viewport)
const StatsSection = dynamic(() => import("@/components/shared/stats-section"));
const FeaturesGrid = dynamic(() => import("@/components/shared/features-grid"));
const HowItWorksSection = dynamic(() => import("@/components/shared/how-it-works-section"));
const UseCasesSection = dynamic(() => import("@/components/shared/use-cases-section"));
const TechStackSection = dynamic(() => import("@/components/shared/tech-stack-section"));
const CTASection = dynamic(() => import("@/components/shared/cta-section"));

/**
 * Landing page - Trang giới thiệu đồ án tốt nghiệp
 *
 * Flow: Hero → Stats (dark) → Features → How It Works → Use Cases
 *       → TechStack (dark) → CTA (dark) → Footer
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroContent />
      <StatsSection />
      <FeaturesGrid />
      <HowItWorksSection />
      <UseCasesSection />
      <TechStackSection />
      <CTASection />
      <Footer />
    </div>
  )
}
