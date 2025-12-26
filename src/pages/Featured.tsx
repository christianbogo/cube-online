import { useMemo } from 'react';
import { Video } from 'lucide-react';

export default function Featured() {
    const videosData = useMemo(() => [
        {
            id: 1,
            title: 'Learn How to Solve a Rubik\'s Cube in 10 Minutes (Beginner Tutorial)',
            creator: 'J Perm',
            url: 'https://www.youtube.com/watch?v=7Ron6MN45LY',
            thumbnail: 'https://img.youtube.com/vi/7Ron6MN45LY/maxresdefault.jpg'
        },
        {
            id: 2,
            title: 'My Puzzle Robot is 200x Faster Than a Human',
            creator: 'Mark Rober',
            url: 'https://www.youtube.com/watch?v=Sqr-PdVYhY4',
            thumbnail: 'https://img.youtube.com/vi/Sqr-PdVYhY4/maxresdefault.jpg'
        },
        {
            id: 3,
            title: '17x17x17 Full Solve',
            creator: 'RedKB',
            url: 'https://www.youtube.com/watch?v=Q4BrzJbtRZg',
            thumbnail: 'https://img.youtube.com/vi/Q4BrzJbtRZg/maxresdefault.jpg'
        },
        {
            id: 4,
            title: 'Why It\'s Almost Impossible to Solve a Rubik\'s Cube in Under 3 Seconds',
            creator: 'WIRED',
            url: 'https://www.youtube.com/watch?v=SUopbexPk3A',
            thumbnail: 'https://img.youtube.com/vi/SUopbexPk3A/maxresdefault.jpg'
        },
        {
            id: 5,
            title: 'The most famous Group ever, the Rubik\'s Cube',
            creator: 'Stand-up Maths',
            url: 'https://www.youtube.com/watch?v=wcpQ-eCOwOU',
            thumbnail: 'https://img.youtube.com/vi/wcpQ-eCOwOU/maxresdefault.jpg'
        },
        {
            id: 6,
            title: 'I Challenged The Rubik\'s World Champion',
            creator: 'Tingman',
            url: 'https://www.youtube.com/watch?v=OLUVcRWa4eU',
            thumbnail: 'https://img.youtube.com/vi/OLUVcRWa4eU/maxresdefault.jpg'
        }
    ], []);

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Featured</h2>

            <div className="animate-in fade-in duration-300">
                <h3 className="text-lg font-medium text-text-primary mb-6 flex items-center gap-2">
                    <Video className="w-5 h-5 text-red-500" /> Community Highlights
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {videosData.map(video => (
                        <a
                            key={video.id}
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group block relative aspect-video rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-black"
                        >
                            <img
                                src={video.thumbnail}
                                alt={video.title}
                                className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-4 flex flex-col justify-end">
                                <h4 className="text-white font-bold text-lg leading-tight mb-1 group-hover:text-accent transition-colors line-clamp-2">
                                    {video.title}
                                </h4>
                                <p className="text-white/70 text-sm font-medium flex items-center gap-2">
                                    by {video.creator}
                                </p>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-lg">
                                    <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1"></div>
                                </div>
                            </div>
                        </a>
                    ))}
                </div>
            </div>
        </div>
    );
}
