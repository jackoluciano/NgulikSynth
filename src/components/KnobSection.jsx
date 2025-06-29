import React from 'react';

const knobLabels = [
    'Square Blend',     // Section 1
    'Triangle Blend',   // Section 2
    'Saw Blend',        // Section 3
    'Distortion',       // Section 4
    'Amplitude',        // Section 5
    'Detune'            // Section 6
];

const KnobSection = ({ onChange }) => {
    return (
        <div className="knob-section">
            {knobLabels.map((label, i) => (
                <div key={i} className="knob-item">
                    <label>{label}</label>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        defaultValue={i === 5 ? 50 : 0}
                        onChange={(e) => onChange(i + 1, Number(e.target.value))}
                        className="knob-input"
                    />
                </div>
            ))}
        </div>
    );
};

export default KnobSection;
