import React, { useState, useRef } from 'react';
import { File as FileIconLucide, XCircle, Paperclip } from 'lucide-react';

const FileInput = ({
    label = "Select File",
    onFileStaged,
    onFileCleared,
    stagedFile,
    currentFileId,
    currentFileName,
    onRemoveExisting,
    acceptedFileTypes,
    disabled
}) => {
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }

        if (file) {
            if (acceptedFileTypes) {
                const allowedTypes = acceptedFileTypes.split(',').map(t => t.trim().toLowerCase());
                const fileTypeLower = file.type.toLowerCase();
                const fileNameLower = file.name.toLowerCase();

                const isAllowed = allowedTypes.some(type => {
                    if (type.startsWith('.')) {
                        return fileNameLower.endsWith(type);
                    }
                    if (type.endsWith('/*')) {
                        return fileTypeLower.startsWith(type.slice(0, -2));
                    }
                    return fileTypeLower === type;
                });

                if (!isAllowed) {
                    setError(`Invalid file type. Allowed: ${acceptedFileTypes}`);
                    if (onFileCleared) {
                        onFileCleared();
                    }
                    return;
                }
            }
            setError(null);
            if (onFileStaged) {
                onFileStaged(file);
            }
        }
    };

    const handleClearStagedFile = () => {
        if (onFileCleared) {
            onFileCleared();
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setError(null);
    };

    const handleRemoveExistingFile = () => {
        if (onRemoveExisting) {
            onRemoveExisting();
        }
        setError(null);
    };

    let displayContent = null;

    if (stagedFile) {
        displayContent = (
            <div className="text-sm text-blue-700 p-2 bg-blue-50 border border-blue-100 rounded-md flex items-center justify-between">
                <div className="flex items-center truncate min-w-0">
                    <Paperclip size={16} className="mr-2 flex-shrink-0" />
                    <span className="font-medium truncate" title={stagedFile.name}>
                        {stagedFile.name} ({stagedFile.size ? `${Math.round(stagedFile.size / 1024)} KB` : 'N/A'}) - Staged
                    </span>
                </div>
                {!disabled && (
                    <button 
                        onClick={handleClearStagedFile} 
                        className="p-1 text-red-500 hover:text-red-700 flex-shrink-0 ml-2" 
                        title="Clear selection"
                        aria-label="Clear selected file"
                    >
                        <XCircle size={16} />
                    </button>
                )}
            </div>
        );
    } else if (currentFileId && currentFileName) {
        displayContent = (
            <div className="p-2 bg-green-50 border border-green-100 rounded-md">
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center text-green-700 truncate min-w-0">
                        <FileIconLucide size={16} className="mr-2 flex-shrink-0" />
                        <span className="font-medium truncate" title={currentFileName}>{currentFileName}</span>
                    </div>
                    {onRemoveExisting && !disabled && (
                        <button 
                            onClick={handleRemoveExistingFile} 
                            className="p-1 text-red-500 hover:text-red-700 flex-shrink-0 ml-2" 
                            title="Remove attached file"
                            aria-label="Remove attached file"
                        >
                            <XCircle size={16} />
                        </button>
                    )}
                </div>
            </div>
        );
    } else {
        displayContent = (
            <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                disabled={disabled}
                accept={acceptedFileTypes}
                className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={label}
            />
        );
    }

    return (
        <div className="p-3 border border-gray-300 rounded-md bg-white space-y-2">
            <label className="block text-xs font-medium text-gray-700">{label}</label>
            {displayContent}
            {error && <p className="text-xs text-red-600 mt-1" role="alert">{error}</p>}
        </div>
    );
};

export default FileInput;