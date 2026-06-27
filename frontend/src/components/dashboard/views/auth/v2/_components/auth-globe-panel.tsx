export function AuthGlobePanel() {
  return (
    <section className="relative h-full overflow-hidden rounded-3xl border border-border/60 bg-[#176E68]">
      <div
        className="absolute inset-0 bg-center bg-cover opacity-35"
        style={{ backgroundImage: "url('/assets/hero-lifestyle.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#176E68]/95 via-[#176E68]/80 to-[#F97316]/70" />

      <div className="relative z-10 flex h-full flex-col items-center justify-center px-8 py-8 text-white">
        <div className="space-y-3 text-center">
          <p className="font-semibold text-white/80 text-xs uppercase tracking-[0.18em]">WanderAware</p>
          <h2 className="max-w-sm font-semibold text-2xl leading-8">Doorway awareness for adult day care teams</h2>
          <p className="max-w-md text-sm text-white/85">
            Manage buildings, RFID readers, participant tags, and wandering alerts from one calm operational dashboard.
          </p>
        </div>
      </div>
    </section>
  );
}
