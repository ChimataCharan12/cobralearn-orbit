import emblem from "@/assets/cobralearn-emblem.png";

export function AdminBranding() {
  return (
    <section className="flex w-full lg:w-[52%] max-w-[600px] flex-col items-center text-center py-3 lg:py-1 lg:self-stretch lg:justify-between lg:translate-x-12 xl:translate-x-16 2xl:translate-x-20">
      {/* 1. TOP & UPPER-MIDDLE BRANDING TEXT */}
      <div className="flex flex-col items-center w-full">
        {/* Top Brand Logo */}
        <div className="flex items-center gap-3 sm:gap-3.5 text-left">
          <img
            src={emblem}
            alt="CobraLearn Emblem"
            width={1024}
            height={1024}
            className="h-[44px] w-[44px] sm:h-[48px] sm:w-[48px] xl:h-[52px] xl:w-[52px] object-contain drop-shadow-[0_0_14px_rgba(0,255,135,0.75)]"
          />
          <div className="flex flex-col justify-center">
            <p className="font-sans text-[23px] sm:text-[25px] xl:text-[27px] font-bold leading-none tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#00ff87] via-[#00f28f] to-[#00d2ff] drop-shadow-[0_0_10px_rgba(0,255,135,0.4)]">
              CobraLearn
            </p>
            <p className="mt-0.5 font-sans text-[11px] sm:text-[11.5px] xl:text-[12px] font-semibold leading-none tracking-wider text-[#38ef7d]">
              Innotechcore
            </p>
          </div>
        </div>

        {/* Slogan */}
        <p className="mt-2 sm:mt-2.5 xl:mt-3 font-sans text-[11.5px] sm:text-[12.5px] xl:text-[13px] font-semibold tracking-[0.5em] text-[#00ff87] drop-shadow-[0_0_8px_rgba(0,255,135,0.55)] whitespace-nowrap uppercase">
          LEARN &nbsp;•&nbsp; BUILD &nbsp;•&nbsp; GROW
        </p>

        {/* Hero Titles */}
        <div className="mt-1 sm:mt-1.5 xl:mt-2 w-full px-2">
          <h1 className="font-sans text-[clamp(2.6rem,4.4vh+1.8vw,4.4rem)] font-bold leading-[0.92] tracking-tight text-[#00ff87] drop-shadow-[0_0_26px_rgba(0,255,135,0.85)] drop-shadow-[0_0_55px_rgba(0,255,135,0.4)]">
            CobraLearn
          </h1>
          <p className="mt-0.5 font-sans text-[clamp(1.75rem,2.8vh+1.2vw,2.9rem)] font-bold leading-[0.96] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.85)]">
            Innotechcore
          </p>
          <p className="mt-1 sm:mt-1.5 font-sans text-[12.5px] sm:text-[13.5px] xl:text-[14.5px] font-semibold tracking-[0.55em] text-[#00ffaa] uppercase drop-shadow-[0_0_12px_rgba(0,255,170,0.55)]">
            Admin &nbsp;Portal
          </p>
        </div>
      </div>

      {/* 2. CENTER: LARGE COBRA/SNAKE EMBLEM (MAIN CENTERPIECE) */}
      <div className="my-auto py-1 sm:py-2 flex justify-center w-full lg:-translate-y-14 xl:-translate-y-18">
        <img
          src={emblem}
          alt="CobraLearn Cobra & Book 3D Emblem"
          width={1024}
          height={1024}
          className="emblem-float w-[clamp(200px,30vh,340px)] max-h-[30vh] object-contain drop-shadow-[0_0_40px_rgba(0,255,135,0.9)] drop-shadow-[0_0_90px_rgba(0,255,135,0.45)]"
        />
      </div>

      {/* 3. BELOW THE SNAKE: DESCRIPTION (Moved upward closer to emblem) */}
      <div className="w-full px-2 pb-1 lg:-translate-y-26 xl:-translate-y-32">
        <p className="mx-auto max-w-[440px] font-sans text-[13px] sm:text-[14px] xl:text-[14.5px] font-normal leading-[1.35] text-[#cbd5e1] drop-shadow-[0_1px_8px_rgba(0,0,0,0.95)]">
          Manage your projects, websites, advertisements
          <br />
          and achievements with ease.
        </p>
      </div>
    </section>
  );
}