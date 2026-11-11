export function Footer() {
  return (
    <footer className="bg-slate-100">
      <div className="mx-auto grid max-w-[1360px] gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-12">
        <div className="lg:col-span-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0b192c] text-sm font-bold text-white">SS</div>
            <span className="font-display text-lg font-bold text-[#0b192c]">Seraya Semesta</span>
          </div>
          <p className="mt-5 font-display font-semibold text-[#0b192c]">Proteksi kargo yang lebih presisi.</p>
          <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
            Solusi stabilisasi beban transit dan pengamanan kontainer standar industri untuk rantai pasok domestik dan ekspor.
          </p>
        </div>
        <div className="lg:col-span-3">
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#0b192c]">Produk</h3>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            {['Dunnage Bag', 'Thermal Liner', 'Security Seal', 'Pallet & Strapping'].map((item) => <li key={item}><a href="#solusi-produk" className="hover:text-sky-600">{item}</a></li>)}
          </ul>
        </div>
        <div className="lg:col-span-4">
          <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-[#0b192c]">Hubungi Kami</h3>
          <p className="mt-4 text-sm leading-6 text-slate-600">Jl. Industri Maritim No. 18<br />Jakarta, Indonesia</p>
          <a href="mailto:sales@serayasemesta.com" className="mt-3 inline-block text-sm font-semibold text-sky-700 hover:text-[#e65100]">sales@serayasemesta.com</a>
        </div>
      </div>
      <div className="border-t border-slate-200 px-4 py-5 text-center font-mono text-[10px] uppercase tracking-wider text-slate-500">
        © 2024 Seraya Semesta Indonesia. All rights reserved.
      </div>
    </footer>
  )
}
