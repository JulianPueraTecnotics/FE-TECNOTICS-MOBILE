import type { HTMLInputTypeAttribute } from "react";
import { v4 as uuidv4 } from 'uuid';
import "./index.css";

interface InputComponentProps {
    label: string;
    type: HTMLInputTypeAttribute;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const InputComponent: React.FC<InputComponentProps> = ({ label, type, value, onChange }) => {
    const id = uuidv4();
    return (
        <div className="input__container">
            <label htmlFor={id}>{label}</label>
            <input type={type} id={id} value={value} onChange={onChange} />
        </div>
    );
};

export default InputComponent;