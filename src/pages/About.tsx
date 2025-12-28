import { Info, Heart } from 'lucide-react';

export default function About() {
    return (
        <div className="w-full max-w-2xl flex flex-col items-start text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">About Cutter's Cubing</h2>
            <p className="text-lg text-text-secondary mb-10 leading-relaxed">
                We are dedicated to building the most responsive, modern, and beautiful speedcubing timer and community platform on the web.
            </p>

            <section className="w-full mb-12">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Info className="w-5 h-5 text-accent" /> Our Mission
                </h3>
                <p className="text-text-secondary mb-4 leading-7">
                    Our goal is to provide a distraction-free, high-performance environment for cubers of all skill levels.
                    We believe that tools should get out of the way and let you focus on what matters: your solve.
                </p>
                <p className="text-text-secondary leading-7">
                    By leveraging modern web technologies like IndexDB for local storage and React for a snappy interface,
                    we ensure your data is always accessible and your timer is always accurate.
                </p>
            </section>

            <section className="w-full mb-12">
                <h3 className="text-xl font-medium text-text-primary mb-4 flex items-center gap-2">
                    <Heart className="w-5 h-5 text-red-500" /> Community
                </h3>
                <p className="text-text-secondary mb-4 leading-7">
                    Cutter's Cubing is more than just a timer. It's a place to share your progress, compete in daily challenges,
                    and race against friends in real-time. We are building a community where everyone can learn and grow together.
                </p>
            </section>


        </div>
    );
}
