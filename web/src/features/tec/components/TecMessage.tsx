import ReactMarkdown from "react-markdown";
import type { TecMessage as TecMessageType } from "../tec.service";

interface Props {
    message: TecMessageType;
    canSendByEmail?: boolean;
    isSendingByEmail?: boolean;
    onSendByEmail?: () => void;
}

/** A partir de esta longitud ofrecemos enviar la respuesta por correo. */
const LONG_THRESHOLD = 350;

const TecMessageBubble: React.FC<Props> = ({ message, canSendByEmail, isSendingByEmail, onSendByEmail }) => {
    if (message.role === "user") {
        return <div className="tec-msg tec-msg--user">{message.content}</div>;
    }

    const showEmail = canSendByEmail && !!onSendByEmail && message.content.length >= LONG_THRESHOLD;

    return (
        <div className="tec-msg tec-msg--assistant">
            <div className="tec-msg__md">
                <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
            {showEmail && (
                <button className="tec-msg__email" onClick={onSendByEmail} disabled={isSendingByEmail}>
                    {isSendingByEmail ? (
                        <><span className="tec-spinner" /> Enviando...</>
                    ) : (
                        <>📧 Enviar al correo</>
                    )}
                </button>
            )}
        </div>
    );
};

export default TecMessageBubble;
