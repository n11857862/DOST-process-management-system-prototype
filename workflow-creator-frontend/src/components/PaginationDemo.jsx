import React, { useState } from 'react';
import { Pagination } from './Pagination';

export const PaginationDemo = () => {
    const [currentPage1, setCurrentPage1] = useState(1);
    const [currentPage2, setCurrentPage2] = useState(5);
    const [currentPage3, setCurrentPage3] = useState(1);
    const [loading, setLoading] = useState(false);

    const handlePageChange = (page, setter) => {
        setLoading(true);
        setter(page);
        setTimeout(() => setLoading(false), 500);
    };

    return (
        <div className="p-8 bg-gray-50 min-h-screen">
            <div className="max-w-6xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Pagination Component Demo</h1>
                    <p className="text-gray-600">Showcasing different configurations of the improved pagination UI</p>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Small Size - Minimal</h2>
                    <p className="text-gray-600 mb-4">Compact pagination for tables with limited space</p>
                    <Pagination
                        currentPage={currentPage1}
                        totalPages={10}
                        totalItems={95}
                        itemsPerPage={10}
                        onPageChange={(page) => handlePageChange(page, setCurrentPage1)}
                        loading={loading}
                        itemLabel="items"
                        size="sm"
                        showFirstLast={false}
                        maxVisiblePages={3}
                    />
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Medium Size - Full Featured</h2>
                    <p className="text-gray-600 mb-4">Standard pagination with first/last buttons and page numbers</p>
                    <Pagination
                        currentPage={currentPage2}
                        totalPages={25}
                        totalItems={1247}
                        itemsPerPage={50}
                        onPageChange={(page) => handlePageChange(page, setCurrentPage2)}
                        loading={loading}
                        itemLabel="workflow instances"
                        size="md"
                        showFirstLast={true}
                        maxVisiblePages={5}
                    />
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Large Size - Prominent</h2>
                    <p className="text-gray-600 mb-4">Large pagination for main content areas</p>
                    <Pagination
                        currentPage={currentPage3}
                        totalPages={8}
                        totalItems={156}
                        itemsPerPage={20}
                        onPageChange={(page) => handlePageChange(page, setCurrentPage3)}
                        loading={loading}
                        itemLabel="tasks"
                        size="lg"
                        showFirstLast={true}
                        maxVisiblePages={7}
                    />
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Without Item Count</h2>
                    <p className="text-gray-600 mb-4">Clean pagination without showing item counts</p>
                    <Pagination
                        currentPage={3}
                        totalPages={12}
                        totalItems={240}
                        itemsPerPage={20}
                        onPageChange={() => {}}
                        loading={false}
                        itemLabel="files"
                        size="md"
                        showItemCount={false}
                        showFirstLast={true}
                        maxVisiblePages={5}
                    />
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Loading State</h2>
                    <p className="text-gray-600 mb-4">Pagination with disabled buttons during loading</p>
                    <Pagination
                        currentPage={7}
                        totalPages={15}
                        totalItems={300}
                        itemsPerPage={20}
                        onPageChange={() => {}}
                        loading={true}
                        itemLabel="records"
                        size="md"
                        showFirstLast={true}
                        maxVisiblePages={5}
                    />
                </div>

                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">Features</h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div>
                            <h3 className="font-medium text-gray-800 mb-2">Design Features</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Modern, clean design with proper spacing</li>
                                <li>• Responsive layout (mobile-friendly)</li>
                                <li>• Three size variants (sm, md, lg)</li>
                                <li>• Consistent with your app's design system</li>
                                <li>• Proper focus states and accessibility</li>
                            </ul>
                        </div>
                        <div>
                            <h3 className="font-medium text-gray-800 mb-2">Functional Features</h3>
                            <ul className="text-sm text-gray-600 space-y-1">
                                <li>• Smart page number display with ellipsis</li>
                                <li>• First/last page buttons (optional)</li>
                                <li>• Loading state support</li>
                                <li>• Customizable item labels</li>
                                <li>• Item count display (optional)</li>
                                <li>• Configurable visible page range</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PaginationDemo; 