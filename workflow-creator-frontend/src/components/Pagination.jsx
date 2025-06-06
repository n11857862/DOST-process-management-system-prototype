import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export const Pagination = ({ 
    currentPage = 1, 
    totalPages = 1, 
    totalItems = 0, 
    itemsPerPage = 10,
    onPageChange, 
    loading = false,
    itemLabel = 'items',
    showItemCount = true,
    showFirstLast = true,
    maxVisiblePages = 5,
    size = 'md'
}) => {
    if (totalPages <= 1) return null;

    const sizeClasses = {
        sm: {
            button: 'px-2 py-1 text-xs',
            icon: 'h-3 w-3',
            text: 'text-xs'
        },
        md: {
            button: 'px-3 py-2 text-sm',
            icon: 'h-4 w-4',
            text: 'text-sm'
        },
        lg: {
            button: 'px-4 py-2 text-base',
            icon: 'h-5 w-5',
            text: 'text-base'
        }
    };

    const classes = sizeClasses[size];

    const getVisiblePages = () => {
        const pages = [];
        const halfVisible = Math.floor(maxVisiblePages / 2);
        
        let startPage = Math.max(1, currentPage - halfVisible);
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        
        return pages;
    };

    const visiblePages = getVisiblePages();
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages && !loading && page !== currentPage) {
            onPageChange(page);
        }
    };

    const buttonBaseClass = `
        relative inline-flex items-center justify-center font-medium transition-all duration-200
        border border-gray-300 bg-white text-gray-700
        hover:bg-gray-50 hover:border-gray-400 hover:text-gray-900
        focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-300
        ${classes.button}
    `;

    const activeButtonClass = `
        relative inline-flex items-center justify-center font-semibold
        border border-indigo-500 bg-indigo-600 text-white
        hover:bg-indigo-700 hover:border-indigo-600
        focus:z-10 focus:outline-none focus:ring-2 focus:ring-indigo-500
        ${classes.button}
    `;

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-4">
            {showItemCount && (
                <div className={`${classes.text} text-gray-700 order-2 sm:order-1`}>
                    <span className="font-medium">
                        Showing {startItem.toLocaleString()} to {endItem.toLocaleString()} of{' '}
                        {totalItems.toLocaleString()} {itemLabel}
                    </span>
                </div>
            )}

            <div className="order-1 sm:order-2">
                <nav className="isolate inline-flex -space-x-px rounded-lg shadow-sm" aria-label="Pagination">
                    {showFirstLast && (
                        <button
                            onClick={() => handlePageChange(1)}
                            disabled={currentPage <= 1 || loading}
                            className={`${buttonBaseClass} rounded-l-lg`}
                            title="First page"
                        >
                            <span className="sr-only">First</span>
                            <ChevronsLeft className={classes.icon} aria-hidden="true" />
                        </button>
                    )}

                    <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage <= 1 || loading}
                        className={`${buttonBaseClass} ${!showFirstLast ? 'rounded-l-lg' : ''}`}
                        title="Previous page"
                    >
                        <span className="sr-only">Previous</span>
                        <ChevronLeft className={classes.icon} aria-hidden="true" />
                    </button>

                    {visiblePages[0] > 1 && (
                        <>
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={loading}
                                className={buttonBaseClass}
                            >
                                1
                            </button>
                            {visiblePages[0] > 2 && (
                                <span className={`relative inline-flex items-center ${classes.button} border border-gray-300 bg-white text-gray-700`}>
                                    ...
                                </span>
                            )}
                        </>
                    )}

                    {visiblePages.map((page) => (
                        <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            disabled={loading}
                            className={page === currentPage ? activeButtonClass : buttonBaseClass}
                            aria-current={page === currentPage ? 'page' : undefined}
                        >
                            {page}
                        </button>
                    ))}

                    {visiblePages[visiblePages.length - 1] < totalPages && (
                        <>
                            {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                                <span className={`relative inline-flex items-center ${classes.button} border border-gray-300 bg-white text-gray-700`}>
                                    ...
                                </span>
                            )}
                            <button
                                onClick={() => handlePageChange(totalPages)}
                                disabled={loading}
                                className={buttonBaseClass}
                            >
                                {totalPages}
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => handlePageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages || loading}
                        className={`${buttonBaseClass} ${!showFirstLast ? 'rounded-r-lg' : ''}`}
                        title="Next page"
                    >
                        <span className="sr-only">Next</span>
                        <ChevronRight className={classes.icon} aria-hidden="true" />
                    </button>

                    {showFirstLast && (
                        <button
                            onClick={() => handlePageChange(totalPages)}
                            disabled={currentPage >= totalPages || loading}
                            className={`${buttonBaseClass} rounded-r-lg`}
                            title="Last page"
                        >
                            <span className="sr-only">Last</span>
                            <ChevronsRight className={classes.icon} aria-hidden="true" />
                        </button>
                    )}
                </nav>
            </div>

            <div className="flex items-center justify-between w-full sm:hidden order-3">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || loading}
                    className={`${buttonBaseClass} rounded-lg`}
                >
                    <ChevronLeft className={classes.icon} />
                    <span className="ml-1">Previous</span>
                </button>
                
                <span className={`${classes.text} text-gray-700 font-medium`}>
                    Page {currentPage} of {totalPages}
                </span>
                
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || loading}
                    className={`${buttonBaseClass} rounded-lg`}
                >
                    <span className="mr-1">Next</span>
                    <ChevronRight className={classes.icon} />
                </button>
            </div>
        </div>
    );
};

export default Pagination; 