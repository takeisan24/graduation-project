"use client";

import Header from "@/components/shared/header";
import Footer from "@/components/shared/footer";
import { useTranslations } from "next-intl";

export default function PrivacyPage() {
  const t = useTranslations("PrivacyPage"); // Placeholder for future i18n

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>
        

        <div className="prose prose-slate dark:prose-invert max-w-none space-y-6">
          <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. Introduction</h2>
            <p>
              Maiovo ("we," "our," or "us") respects your privacy and is committed to protecting your personal data. 
              This Privacy Policy explains how we collect, use, and share information about you when you use our AI content creation 
              and automation platform (the "Service").
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Account Information:</strong> Name, email address, password, and subscription details.</li>
              <li><strong>User Content:</strong> Videos, images, documents, texts, and other media you upload for processing.</li>
              <li><strong>Social Media Data:</strong> If you connect your social media accounts (e.g., YouTube, TikTok, Instagram), 
              we collect necessary tokens and permissions to post content on your behalf. We do not store your social media passwords.</li>
              <li><strong>Brand Information:</strong> Logos, brand voice preferences, and product details used to train your custom AI profile.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. How We Use Your Information</h2>
            <p>
              We use your information to:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li>Provide, maintain, and improve our AI generation and scheduling services.</li>
              <li>Process your uploaded content using AI models to generate descriptions, captions, and derived media.</li>
              <li>Publish content to your connected social media platforms upon your request.</li>
              <li>Communicate with you about updates, security alerts, and support messages.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. Data Sharing and Third Parties</h2>
            <p>
              We may share your data with trusted third-party service providers solely for the purpose of operating our Service:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-2">
              <li><strong>AI Providers:</strong> We integrate with third-party AI models (e.g., OpenAI, ElevenLabs, HeyGen) to generate content. 
              Your input data may be sent to these providers for processing but is not used to train their public models.</li>
              <li><strong>Cloud Infrastructure:</strong> We use secure cloud hosting providers to store your data.</li>
              <li><strong>Social Platforms:</strong> We transmit your content to social media platforms (YouTube, TikTok, etc.) via their APIs 
              only when you execute a publish or schedule action.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. Data Security</h2>
            <p>
              We implement industry-standard security measures to protect your information. However, no method of transmission 
              over the Internet is 100% secure. You are responsible for securing your account credentials.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. Your Rights</h2>
            <p>
              You have the right to access, correct, or delete your personal data. You can manage your connected social media accounts 
              directly within the application settings. To request full account deletion, please contact us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy to reflect changes in our services or legal requirements. We will notify you of any 
              material changes by posting the new policy on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at support@maiovo.com.
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
