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
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Buscar o seleccionar...',
  disabled = false,
  id,
  'aria-label': ariaLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : '';

  useEffect(() => {
    if (isOpen) {
      setInputText(displayLabel);
    } else {
      setInputText(displayLabel);
    }
  }, [isOpen, value, displayLabel]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setInputText(displayLabel);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [displayLabel]);

  const filteredOptions = options.filter((opt) =>
    opt.label.toLowerCase().includes(inputText.toLowerCase())
  );

  const handleSelect = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setInputText(opt.label);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
    setInputText(displayLabel);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    setIsOpen(true);
    if (!e.target.value) onChange('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setInputText(displayLabel);
    }
  };

  return (
    <div className="searchable-select" ref={containerRef}>
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
