import React, { useState, useEffect, useMemo } from 'react';

// Componente principal de la aplicación
const App = () => {
    // Estado para almacenar el texto de la oferta laboral
    const [jobDescription, setJobDescription] = useState('');
    // Estado para almacenar los CVs cargados (nombre del archivo y contenido de texto)
    const [cvs, setCvs] = useState([]);
    // Estado para almacenar los resultados clasificados
    const [classifiedCvs, setClassifiedCvs] = useState([]);
    // Estado para mensajes de error o información al usuario
    const [message, setMessage] = useState('Sube CVs y/o ingresa una oferta laboral para ver los resultados.');
    // Estado para controlar la carga de archivos
    const [isLoading, setIsLoading] = useState(false);
    // Estado para el modal
    const [modal, setModal] = useState({ isOpen: false, cv: null });

    // Cargar el script de pdf.js
    useEffect(() => {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.min.js";
        script.async = true;
        document.body.appendChild(script);

        // Definir el workerSrc para pdf.js
        script.onload = () => {
            if (window.pdfjsLib) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;
            }
        };

        return () => {
            document.body.removeChild(script);
        };
    }, []);

    // Función para limpiar y tokenizar el texto
    const cleanAndTokenize = (text) => {
        if (!text) return [];
        return text
            .toLowerCase()
            .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '') // Elimina puntuación
            .replace(/\s{2,}/g, ' ') // Reemplaza múltiples espacios
            .split(/\s+/) // Divide por espacios
            .filter(word => word.length > 1); // Filtra palabras cortas
    };

    // Función para calcular la similitud entre dos textos
    const calculateSimilarity = useMemo(() => (jobDesc, cvContent) => {
        if (!jobDesc || !cvContent) return 0;
        const jobTokens = new Set(cleanAndTokenize(jobDesc));
        const cvTokens = new Set(cleanAndTokenize(cvContent));
        if (jobTokens.size === 0) return 0;
        let commonWordsCount = 0;
        for (const token of cvTokens) {
            if (jobTokens.has(token)) {
                commonWordsCount++;
            }
        }
        const similarity = commonWordsCount / jobTokens.size;
        return parseFloat(similarity.toFixed(2));
    }, []);

    // Efecto que se ejecuta para clasificar los CVs cuando cambian
    useEffect(() => {
        if (jobDescription.trim() === '' || cvs.length === 0) {
            setClassifiedCvs([]);
            return;
        }
        try {
            const results = cvs.map(cv => ({
                ...cv,
                similarity: calculateSimilarity(jobDescription, cv.content)
            }));
            results.sort((a, b) => b.similarity - a.similarity);
            setClassifiedCvs(results);
            if (!isLoading) {
                 setMessage('Clasificación completada.');
            }
        } catch (error) {
            console.error("Error al procesar los CVs:", error);
            setMessage('Ocurrió un error al procesar los CVs.');
        }
    }, [cvs, jobDescription, calculateSimilarity, isLoading]);

    // Función para extraer texto de un archivo PDF
    const getTextFromPdf = async (file) => {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument(arrayBuffer).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            fullText += textContent.items.map(item => item.str).join(' ') + '\n';
        }
        return fullText;
    };

    // Maneja la carga de archivos CV
    const handleFileChange = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;

        if (files.length > 20) {
            setMessage('Por favor, sube un máximo de 20 CVs.');
            return;
        }

        setIsLoading(true);
        setMessage('Cargando y procesando CVs...');
        
        const loadedCvsPromises = files.map(async (file) => {
            try {
                let content = '';
                if (file.type === 'text/plain') {
                    content = await file.text();
                } else if (file.type === 'application/pdf') {
                    if (window.pdfjsLib) {
                        content = await getTextFromPdf(file);
                    } else {
                        throw new Error('La librería PDF.js no está cargada.');
                    }
                } else {
                    console.warn(`Tipo de archivo no soportado: ${file.name}`);
                    return null;
                }
                return { name: file.name, content };
            } catch (error) {
                console.error(`Error al leer el archivo ${file.name}:`, error);
                setMessage(`Error al procesar ${file.name}.`);
                return null;
            }
        });

        const loadedCvs = (await Promise.all(loadedCvsPromises)).filter(Boolean);
        setCvs(prevCvs => [...prevCvs, ...loadedCvs]); // Añade los nuevos CVs a la lista existente
        setIsLoading(false);
        
        // Limpiar el input para permitir subir el mismo archivo de nuevo
        event.target.value = '';

        if (loadedCvs.length > 0) {
            setMessage(`${loadedCvs.length} CV(s) nuevo(s) cargado(s) exitosamente.`);
        } else {
            setMessage('No se pudieron cargar CVs válidos. Por favor, intenta con archivos .txt o .pdf.');
        }
    };
    
    // Función para quitar un CV de la lista
    const handleRemoveCv = (indexToRemove) => {
        setCvs(prevCvs => prevCvs.filter((_, index) => index !== indexToRemove));
        setMessage('Archivo quitado. Puedes subir más o analizar los actuales.');
    };

    // Abrir el modal con el CV seleccionado
    const openModal = (cv) => {
        setModal({ isOpen: true, cv });
    };

    // Cerrar el modal
    const closeModal = () => {
        setModal({ isOpen: false, cv: null });
    };

    // Componente Modal
    const CVModal = ({ cv, onClose }) => {
        if (!cv) return null;
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                    <div className="flex justify-between items-center p-4 border-b">
                        <h3 className="text-xl font-bold text-gray-800">{cv.name}</h3>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <pre className="whitespace-pre-wrap text-gray-700 font-sans">{cv.content}</pre>
                    </div>
                     <div className="flex justify-end p-4 border-t">
                        <button onClick={onClose} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition duration-300">Cerrar</button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
                .overflow-y-auto::-webkit-scrollbar { width: 8px; }
                .overflow-y-auto::-webkit-scrollbar-track { background: #f1f1f1; }
                .overflow-y-auto::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
                .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: #555; }
            `}</style>

            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl mb-8">
                <h1 className="text-3xl font-bold text-gray-800 mb-6 text-center">Clasificador de CVs Inteligente</h1>

                {/* Sección de carga de CVs */}
                <div className="mb-6">
                    <label htmlFor="cv-upload" className="block text-gray-700 text-lg font-semibold mb-2">1. Sube los CVs (.txt o .pdf)</label>
                    <input type="file" id="cv-upload" accept=".txt,.pdf" multiple onChange={handleFileChange} disabled={isLoading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"/>
                </div>

                {/* NUEVO: Sección para mostrar y gestionar archivos cargados */}
                {cvs.length > 0 && (
                    <div className="mb-6">
                        <h3 className="text-gray-700 text-lg font-semibold mb-3">Archivos listos para analizar:</h3>
                        <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {cvs.map((cv, index) => (
                                <li key={index} className="flex justify-between items-center bg-gray-100 p-3 rounded-lg animate-fade-in">
                                    <span className="text-gray-800 text-sm truncate pr-2">{cv.name}</span>
                                    <button onClick={() => handleRemoveCv(index)} disabled={isLoading} className="bg-red-500 hover:bg-red-600 text-white font-bold py-1 px-3 rounded-full text-xs transition-colors disabled:opacity-50">Quitar</button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Sección de ingreso de oferta laboral */}
                <div className="mb-6">
                    <label htmlFor="job-description" className="block text-gray-700 text-lg font-semibold mb-2">2. Pega la descripción de la oferta</label>
                    <textarea id="job-description" className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 resize-y min-h-[150px]" placeholder="Pega aquí la descripción completa de la oferta laboral..." value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} disabled={isLoading}></textarea>
                </div>

                {/* Mensajes de estado y carga */}
                {(message || isLoading) && (
                    <div className={`px-4 py-3 rounded-lg relative mb-6 flex items-center ${isLoading ? 'bg-yellow-100 border-yellow-400 text-yellow-700' : 'bg-blue-100 border-blue-400 text-blue-700'}`} role="alert">
                        {isLoading && (
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        <span className="block sm:inline">{message}</span>
                    </div>
                )}
            </div>

            {/* Sección de resultados */}
            {classifiedCvs.length > 0 && (
                <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Resultados de Clasificación</h2>
                    <ul className="space-y-4">
                        {classifiedCvs.map((cv, index) => (
                            <li key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between transition-transform hover:scale-[1.02]">
                                <div className="flex-1 mb-3 md:mb-0 pr-4">
                                    <h3 className="text-lg font-semibold text-gray-800">{cv.name}</h3>
                                    <p className="text-gray-500 text-sm italic mt-2 line-clamp-2">{cv.content.substring(0, 200).replace(/\s+/g, ' ')}...</p>
                                </div>
                                <div className="flex items-center flex-shrink-0">
                                     <div className="text-center mr-4">
                                        <p className="text-sm text-gray-600">Similitud</p>
                                        <span className="font-bold text-xl text-blue-600">{(cv.similarity * 100).toFixed(0)}%</span>
                                    </div>
                                    <button onClick={() => openModal(cv)} className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full transition duration-300 ease-in-out shadow-md">Ver Completo</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            
            {modal.isOpen && <CVModal cv={modal.cv} onClose={closeModal} />}
        </div>
    );
};

export default App;