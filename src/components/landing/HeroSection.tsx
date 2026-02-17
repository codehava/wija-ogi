import { transliterateLatin } from '@/lib/transliteration/engine';

interface HeroSectionProps {
    onLogin: () => void;
}

export function HeroSection({ onLogin }: HeroSectionProps) {
    const subtitle = "Warisan Digital Keluarga Bugis-Makassar";
    const subtitleLontara = transliterateLatin(subtitle).lontara;

    return (
        <section className="relative pt-20 pb-20 md:pt-32 md:pb-24 px-4 overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 -z-10"></div>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-teal-200/20 rounded-full blur-[100px] -z-10 translate-x-1/3 -translate-y-1/3"></div>
            <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-amber-200/20 rounded-full blur-[100px] -z-10 -translate-x-1/3 translate-y-1/3"></div>

            <div className="max-w-4xl mx-auto text-center relative z-10">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-teal-100 shadow-sm mb-8 animate-fade-in-up">
                    <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                    <span className="text-xs font-medium text-teal-700 tracking-wide">WIJA-OGI VERSION 3.0</span>
                </div>

                {/* Headline - Responsive Typography */}
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-stone-800 tracking-tight leading-[1.1] mb-6 animate-fade-in-up delay-100">
                    Warisan Digital <br className="hidden md:block" />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-cyan-600">
                        Keluarga Bugis-Makassar
                    </span> <br />
                    dalam Genggaman
                </h1>

                {/* Subheadline with Lontara */}
                <div className="space-y-4 mb-10 animate-fade-in-up delay-200">
                    <p className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto leading-relaxed">
                        Dokumentasikan sejarah keluarga Anda dengan fitur silsilah interaktif dan transliterasi otomatis Lontara.
                    </p>
                    <p className="font-lontara text-2xl text-teal-600/60 select-none">
                        {subtitleLontara}
                    </p>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up delay-300">
                    <button
                        onClick={onLogin}
                        className="w-full sm:w-auto px-8 py-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-teal-600/20 transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group"
                    >
                        <span>Mulai Telusuri Jejak</span>
                        <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                    </button>

                    <button className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-stone-50 text-stone-700 border border-stone-200 rounded-xl font-medium transition-all hover:border-stone-300 flex items-center justify-center gap-2">
                        <span>Pelajari Lebih Lanjut</span>
                    </button>
                </div>
            </div>
        </section>
    );
}
