import Header from "@/components/shared/header";
import HeroContent from "@/components/shared/hero-content";
import StatsSection from "@/components/shared/stats-section";
import FeaturesGrid from "@/components/shared/features-grid";
import HowItWorksSection from "@/components/shared/how-it-works-section";
import UseCasesSection from "@/components/shared/use-cases-section";
import TechStackSection from "@/components/shared/tech-stack-section";
import CTASection from "@/components/shared/cta-section";
import Footer from "@/components/shared/footer";

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
