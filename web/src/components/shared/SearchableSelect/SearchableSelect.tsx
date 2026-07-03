import React, { useState, useRef, useEffect } from 'react';
import './SearchableSelect.css';

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  'aria-label'?: string;
  /** Si es true, una vez seleccionado el input muestra SOLO el value (código), no el label. */
  displayValueOnly?: boolean;
  /** Dentro de FilterField/FieldInput (sin borde propio). */
  embedded?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar o seleccionar...',
  disabled = false,
  id,
  'aria-label': ariaLabel,
  displayValueOnly = false,
  embedded = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  // El usuario borró el texto a propósito: no re-inyectar la selección anterior.
  const [cleared, setCleared] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  // Texto a mostrar cuando NO se está editando: solo el código, o el label completo.
  const displayLabel = selectedOption ? (displayValueOnly ? selectedOption.value : selectedOption.label) : '';

  // Sincroniza el texto con el valor seleccionado, salvo que el usuario lo haya vaciado.
  useEffect(() => {
    if (!cleared) setInputText(displayLabel);
  }, [value, displayLabel, cleared]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // Al cerrar: si quedó en blanco, respétalo; si no, muestra la selección.
        setInputText(cleared ? '' : displayLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [displayLabel, cleared]);

  // Al filtrar mientras se escribe, comparar contra el label (más rico que el código).
  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(inputText.toLowerCase())
  );

  const handleSelect = (opt: SearchableSelectOption) => {
    setCleared(false);
    onChange(opt.value);
    setInputText(displayValueOnly ? opt.value : opt.label);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    if (!cleared) setInputText(displayLabel);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setInputText(text);
    setIsOpen(true);
    if (!text) {
      // Vaciado intencional: queda en blanco y se limpia el valor (no se resetea al anterior).
      setCleared(true);
      onChange('');
    } else {
      setCleared(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setInputText(cleared ? '' : displayLabel);
    }
  };

  return (
    <div className={`searchable-select${embedded ? " searchable-select--embedded" : ""}`} ref={containerRef}>
      <input
        type="text"
        id={id}
        className="searchable-select__input"
        value={inputText}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      />
      <button
        type="button"
        className="searchable-select__toggle"
        onClick={() => !disabled && setIsOpen((o) => !o)}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Abrir lista"
      >
        <i className={`ri-arrow-down-s-line ${isOpen ? 'searchable-select__chevron-open' : ''}`} />
      </button>
      {isOpen && (
        <ul
          className="searchable-select__dropdown"
          role="listbox"
          aria-activedescendant={value ? `option-${value}` : undefined}
        >
          {filteredOptions.length === 0 ? (
            <li className="searchable-select__option searchable-select__option--empty">
              No hay coincidencias
            </li>
          ) : (
            filteredOptions.map((opt) => (
              <li
                key={opt.value}
                id={`option-${opt.value}`}
                role="option"
                aria-selected={opt.value === value}
                className={`searchable-select__option ${opt.value === value ? 'searchable-select__option--selected' : ''}`}
                onClick={() => handleSelect(opt)}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;
