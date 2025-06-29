import React, { useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';
import KnobSection from './KnobSection.jsx';
import '../styles/global.css';

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OCTAVES = Array.from({ length: 8 }, (_, i) => i + 1);
const noteToFreq = (note) => Tone.Frequency(note).toFrequency();

const NoteSelector = ({ onChange, current, onSelectActive }) => {
    const [selected, setSelected] = useState([]);

    const toggleNote = (note) => {
        const updated = selected.includes(note)
            ? selected.filter(n => n !== note)
            : [...selected, note];
        setSelected(updated);
        onChange(updated);
    };

    useEffect(() => {
        onSelectActive(selected);
    }, [selected]);

    return (
        <div className="note-selector-container">
            {OCTAVES.map(oct => (
                <div key={oct} className="note-row">
                    {NOTES.map(n => {
                        const note = `${n}${oct}`;
                        const isActive = selected.includes(note);
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

const SynthControls = () => {
    const synthRef = useRef([]);
    const analyserRef = useRef(null);
    const canvasRef = useRef(null);

    const [amplitude, setAmplitude] = useState(-40);
    const [activeNotes, setActiveNotes] = useState([]);
    const [playingNotes, setPlayingNotes] = useState([]);
    const [chordTarget, setChordTarget] = useState([]);
    const [morph, setMorph] = useState({ square: 0, triangle: 0, saw: 0 });
    const [distortionAmount, setDistortionAmount] = useState(0);

    useEffect(() => {
        const dbGain = Math.pow(10, amplitude / 20);
        synthRef.current.forEach(v => v.master?.gain.rampTo(dbGain, 0.1));
    }, [amplitude]);

    useEffect(() => {
        synthRef.current.forEach(v => {
            v.gSine.gain.rampTo(1 - morph.square - morph.triangle - morph.saw, 0.1);
            v.gSquare.gain.rampTo(morph.square, 0.1);
            v.gTriangle.gain.rampTo(morph.triangle, 0.1);
            v.gSaw.gain.rampTo(morph.saw, 0.1);
        });
    }, [morph]);

    useEffect(() => {
        synthRef.current.forEach(v => v.dist.distortion = distortionAmount);
    }, [distortionAmount]);

    const handleStart = async () => {
        await Tone.start();
        if (!analyserRef.current) {
            analyserRef.current = new Tone.Analyser('waveform', 1024);
        }

        if (synthRef.current.length === 0 && activeNotes.length > 0) {
            const master = new Tone.Gain(Math.pow(10, amplitude / 20)).connect(analyserRef.current).toDestination();
            const dist = new Tone.Distortion(distortionAmount).connect(master);

            const voices = activeNotes.map(note => {
                const freq = noteToFreq(note);
                const osc = (type) => new Tone.Oscillator({ frequency: freq, type }).start();

                const oscSine = osc('sine');
                const oscSquare = osc('square');
                const oscTriangle = osc('triangle');
                const oscSaw = osc('sawtooth');

                const g = (value) => new Tone.Gain(value).connect(dist);

                const gSine = g(1 - morph.square - morph.triangle - morph.saw);
                const gSquare = g(morph.square);
                const gTriangle = g(morph.triangle);
                const gSaw = g(morph.saw);

                oscSine.connect(gSine);
                oscSquare.connect(gSquare);
                oscTriangle.connect(gTriangle);
                oscSaw.connect(gSaw);

                return { note, oscSine, oscSquare, oscTriangle, oscSaw, gSine, gSquare, gTriangle, gSaw, master, dist };
            });

            synthRef.current = voices;
            setPlayingNotes(activeNotes);
        }
    };

    const handleStop = () => {
        synthRef.current.forEach(v => {
            [v.oscSine, v.oscSquare, v.oscTriangle, v.oscSaw].forEach(o => { o.stop(); o.dispose(); });
            [v.gSine, v.gSquare, v.gTriangle, v.gSaw].forEach(g => g.dispose());
            v.master.dispose();
            v.dist.dispose();
        });
        synthRef.current = [];
        setPlayingNotes([]);
    };

    const handleChangeChord = () => {
        if (chordTarget.length === 0) return;

        const old = synthRef.current;
        const target = chordTarget;
        const newVoices = [];

        const master = old[0]?.master || new Tone.Gain(Math.pow(10, amplitude / 20)).connect(analyserRef.current).toDestination();
        const dist = old[0]?.dist || new Tone.Distortion(distortionAmount).connect(master);

        for (let i = 0; i < target.length; i++) {
            const toNote = target[i];
            const freqTo = noteToFreq(toNote);

            let v = old[i] ?? old[old.length - 1];
            if (i >= old.length) {
                const cloneOsc = (type, freq) => new Tone.Oscillator({ frequency: freq, type }).start();
                const cloneGain = (val) => new Tone.Gain(val).connect(dist);

                const freq = noteToFreq(v.note);
                const oscSine = cloneOsc('sine', freq);
                const oscSquare = cloneOsc('square', freq);
                const oscTriangle = cloneOsc('triangle', freq);
                const oscSaw = cloneOsc('sawtooth', freq);

                const gSine = cloneGain(v.gSine.gain.value);
                const gSquare = cloneGain(v.gSquare.gain.value);
                const gTriangle = cloneGain(v.gTriangle.gain.value);
                const gSaw = cloneGain(v.gSaw.gain.value);

                oscSine.connect(gSine);
                oscSquare.connect(gSquare);
                oscTriangle.connect(gTriangle);
                oscSaw.connect(gSaw);

                v = { note: v.note, oscSine, oscSquare, oscTriangle, oscSaw, gSine, gSquare, gTriangle, gSaw, master, dist };
            }

            [v.oscSine, v.oscSquare, v.oscTriangle, v.oscSaw].forEach(o => o.frequency.rampTo(freqTo, 0.7));
            v.note = toNote;
            newVoices.push(v);
        }

        for (let i = target.length; i < old.length; i++) {
            const v = old[i];
            const nearestFreq = noteToFreq(target[i % target.length]);
            [v.oscSine, v.oscSquare, v.oscTriangle, v.oscSaw].forEach(o => o.frequency.rampTo(nearestFreq, 0.7));
            [v.gSine, v.gSquare, v.gTriangle, v.gSaw].forEach(g => g.gain.rampTo(0, 1.5));

            setTimeout(() => {
                [v.oscSine, v.oscSquare, v.oscTriangle, v.oscSaw].forEach(o => { o.stop(); o.dispose(); });
                [v.gSine, v.gSquare, v.gTriangle, v.gSaw].forEach(g => g.dispose());
            }, 2000);
        }

        synthRef.current = newVoices;
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        const draw = () => {
            requestAnimationFrame(draw);
            if (!analyserRef.current) return;

            const values = analyserRef.current.getValue();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            for (let i = 0; i < values.length; i++) {
                const x = (i / values.length) * canvas.width;
                const y = (0.5 - values[i] * 0.8) * canvas.height;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.strokeStyle = 'lime';
            ctx.lineWidth = 2;
            ctx.stroke();
        };
        draw();
    }, []);

    return (
        <div className="Body">
            <div className="synth-controls-container">
                <h2 className="synth-header">Synth Control Panel</h2>

                <div className="canvas-knob-container">
                    <div className="canvas-button-container">
                        <canvas
                            ref={canvasRef}
                            width={600}
                            height={200}
                            className="canvas"
                        />
                        <div className="button-container">
                            <button className="button" onClick={handleStart} disabled={activeNotes.length === 0}>Start Synth</button>
                            <button className="button" onClick={handleStop} disabled={synthRef.current.length === 0}>Stop Synth</button>
                            <button className="button" onClick={handleChangeChord} disabled={synthRef.current.length === 0}>Change</button>
                        </div>
                    </div>

                    <div className="knob-section">
                        <KnobSection
                            onChange={(section, value) => {
                                if (section === 1) setMorph(m => ({ ...m, square: value / 100 }));
                                if (section === 2) setMorph(m => ({ ...m, triangle: value / 100 }));
                                if (section === 3) setMorph(m => ({ ...m, saw: value / 100 }));
                                if (section === 4) setDistortionAmount(value / 100);
                                if (section === 5) setAmplitude(value - 40);
                                if (section === 6) {
                                    synthRef.current.forEach(({ oscSine, oscSquare, oscTriangle, oscSaw }) => {
                                        const detune = value - 50;
                                        [oscSine, oscSquare, oscTriangle, oscSaw].forEach(o => o.detune.rampTo(detune, 0.3));
                                    });
                                }
                            }}
                        />
                    </div>
                </div>

                <div className="note-selector-item-container">
                    <NoteSelector onChange={setChordTarget} current={activeNotes} onSelectActive={setActiveNotes} />
                </div>
            </div>
        </div>
    );
};

export default SynthControls;