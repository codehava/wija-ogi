export function FeatureGrid() {
    return (
        <section className="py-12 px-4 max-w-7xl mx-auto">
            <h3 className="text-center text-2xl font-bold text-stone-800 mb-8">Fitur Unggulan</h3>

            {/* Bento Grid Layout - Responsive */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 auto-rows-[200px]">

                {/* Lontara Feature - Large Card */}
                <div className="md:col-span-2 row-span-1 md:row-span-2 glass rounded-3xl p-8 relative overflow-hidden group hover:shadow-xl transition-all duration-500 bg-gradient-to-br from-emerald-50 to-teal-50 border border-teal-100">
                    <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-teal-500 text-white flex items-center justify-center text-xl mb-4 shadow-lg group-hover:scale-110 transition-transform">
                            📜
                        </div>
                        <h4 className="text-2xl font-bold text-stone-800 mb-2">Aksara Lontara Otomatis</h4>
                        <p className="text-stone-600 max-w-md">
                            Setiap nama yang Anda input otomatis ditransliterasi ke aksara Lontara.
                            Melestarikan tradisi tulis Bugis-Makassar tanpa repot.
                        </p>
                    </div>
                    {/* Decorative Background */}
                    <div className="absolute -right-10 -bottom-10 text-[150px] opacity-5 font-lontara select-none pointer-events-none group-hover:opacity-10 transition-opacity">
                        ᨒᨚᨈᨑ
                    </div>
                </div>

                {/* Tree Visualization */}
                <div className="glass rounded-3xl p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-blue-50 bg-gradient-to-br from-blue-50 to-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center shadow-md">
                            🌳
                        </div>
                        <h4 className="font-bold text-stone-800">Pohon Keluarga</h4>
                    </div>
                    <p className="text-sm text-stone-600">
                        Visualisasi modern yang rapi, mendukung hingga ribuan anggota keluarga dalam satu kanvas.
                    </p>
                </div>

                {/* Realtime Sync */}
                <div className="glass rounded-3xl p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-amber-50 bg-gradient-to-br from-amber-50 to-white">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-md">
                            🔄
                        </div>
                        <h4 className="font-bold text-stone-800">Kolaborasi</h4>
                    </div>
                    <p className="text-sm text-stone-600">
                        Undang kerabat untuk mengedit bersama. Perubahan tersimpan otomatis secara real-time.
                    </p>
                </div>

                {/* Export PDF */}
                <div className="md:col-span-1 glass rounded-3xl p-6 relative overflow-hidden group hover:shadow-lg transition-all duration-300 border border-purple-50 bg-gradient-to-br from-purple-50 to-white">
                    <div className="flex flex-col h-full justify-between">
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 rounded-lg bg-purple-500 text-white flex items-center justify-center shadow-md">
                                    🖨️
                                </div>
                                <h4 className="font-bold text-stone-800">Cetak PDF</h4>
                            </div>
                            <p className="text-sm text-stone-600">
                                Ekspor silsilah siap cetak dengan kualitas tinggi.
                            </p>
                        </div>
                        <div className="mt-2 text-xs font-medium text-purple-600 translate-x-0 group-hover:translate-x-1 transition-transform">
                            Mendukung berbagai ukuran kertas &rarr;
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}
