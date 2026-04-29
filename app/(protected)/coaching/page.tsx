export const runtime = "edge";

export default function CoachingPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16">
      <p className="text-xs tracking-[0.25em] uppercase text-[#AF493B] mb-4">Work with Lisa</p>
      <h1 className="text-4xl font-light text-[#2B2B2B] mb-6" style={{ fontFamily: "Georgia, serif" }}>
        Strategy &amp; Coaching
      </h1>
      <p className="text-[#6B6560] mb-10 text-lg leading-relaxed">
        You&apos;ve built the foundation. Now let&apos;s bring it to life. Book a 1:1 strategy call
        with Lisa to pressure-test your brand, refine your direction, and map out your next moves.
      </p>
      <a
        href="https://photolilo.com/contact"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block px-8 py-4 bg-[#AF493B] text-white text-sm tracking-wide hover:bg-[#9D4134] transition-colors rounded-sm"
      >
        Book a Call with Lisa
      </a>
    </div>
  );
}
