import React, { useState } from 'react';
import '../styles/NoteSelector.css';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = Array.from({ length: 8 }, (_, i) => i + 1);

const NoteSelector = ({ onChange }) => {
    const [activeNotes, setActiveNotes] = useState([]);

    const toggleNote = (note) => {
        const updated = activeNotes.includes(note)
            ? activeNotes.filter(n => n !== note)
            : [...activeNotes, note];

        setActiveNotes(updated);
        onChange(updated);
    };

    return (
        <div className="note-selector-container">
            {OCTAVES.map((oct) => (
                <div key={oct} className="octave-row">
                    {NOTES.map((n) => {
                        const note = `${n}${oct}`;
                        const isActive = activeNotes.includes(note);
                        return (
                            <button
                                key={note}
                                onClick={() => toggleNote(note)}
                                className={`note-button ${isActive ? 'active' : ''}`}
                            >
                                {note}
                            </button>
                        );
                    })}
                </div>
            ))}
        </div>
    );
};

export default NoteSelector;
