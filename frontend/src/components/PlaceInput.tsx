import { useEffect, useId, useRef, useState } from "react";
import { geocode } from "../lib/api";
import type { Place } from "../types";

interface Props {
  label: string;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

export function PlaceInput({ label, placeholder, value, onChange }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? "");
  const [options, setOptions] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [searching, setSearching] = useState(false);
  const typed = useRef(false);

  useEffect(() => {
    if (value) setText(value.label);
    else if (!typed.current) setText("");
  }, [value]);

  useEffect(() => {
    if (!typed.current || text.trim().length < 2) {
      setOptions([]);
      return;
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      geocode(text, ctrl.signal)
        .then((places) => {
          setOptions(places);
          setActive(0);
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text]);

  const choose = (place: Place) => {
    typed.current = false;
    onChange(place);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || !options.length) return;
    if (e.key === "ArrowDown") setActive((a) => (a + 1) % options.length);
    else if (e.key === "ArrowUp") setActive((a) => (a - 1 + options.length) % options.length);
    else if (e.key === "Enter") choose(options[active]);
    else if (e.key === "Escape") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <div className="field place-input">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => options.length && setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {searching && <span className="place-input__spinner" aria-hidden />}
      {open && options.length > 0 && (
        <ul className="place-input__list" id={`${id}-list`} role="listbox">
          {options.map((p, i) => (
            <li
              key={`${p.lat},${p.lon},${i}`}
              role="option"
              aria-selected={i === active}
              className={i === active ? "active" : ""}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(p);
              }}
              onMouseEnter={() => setActive(i)}
            >
              {p.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
