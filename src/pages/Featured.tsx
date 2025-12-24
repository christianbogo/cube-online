import { useMemo } from 'react';
import Tabs from '../components/Tabs';
import Table from '../components/Table';
import { Video, Award } from 'lucide-react';

export default function Featured() {
    const recordsData = useMemo(() => [
        { id: 1, event: '3x3', holder: 'Max Park', time: '3.13s', date: '2023' },
        { id: 2, event: '2x2', holder: 'Teodor Zayn', time: '0.43s', date: '2023' },
    ], []);

    const videosData = useMemo(() => [
        { id: 1, title: 'How to get sub-10', creator: 'J Perm', duration: '12:30' },
        { id: 2, title: 'Example Solves', creator: 'CubeHead', duration: '8:45' },
    ], []);

    const recordColumns = [
        { header: 'Event', accessor: 'event' as const },
        { header: 'Record Holder', accessor: 'holder' as const },
        { header: 'Time', accessor: 'time' as const },
        { header: 'Date', accessor: 'date' as const },
    ];

    const videoColumns = [
        { header: 'Title', accessor: 'title' as const },
        { header: 'Creator', accessor: 'creator' as const },
        { header: 'Duration', accessor: 'duration' as const },
    ];

    const tabs = [
        {
            id: 'records',
            label: 'World Records',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Award className="w-5 h-5 text-yellow-500" /> Current Records
                    </h3>
                    <Table data={recordsData} columns={recordColumns} />
                </div>
            )
        },
        {
            id: 'videos',
            label: 'Spotlight Videos',
            content: (
                <div className="animate-in fade-in duration-300">
                    <h3 className="text-lg font-medium text-text-primary mb-4 flex items-center gap-2">
                        <Video className="w-5 h-5 text-red-500" /> Community Highlights
                    </h3>
                    <Table data={videosData} columns={videoColumns} />
                </div>
            )
        }
    ];

    return (
        <div className="w-full h-full flex flex-col text-left">
            <h2 className="text-3xl font-semibold mb-6 text-text-primary">Featured</h2>
            <Tabs tabs={tabs} />
        </div>
    );
}
