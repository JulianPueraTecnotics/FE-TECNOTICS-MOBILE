import { useEffect, useRef, useState } from "react";
import TecMessageBubble from "./TecMessage";
import { sendTecMessage, sendTecByEmail, isTecUnavailable, type TecMessage } from "../tec.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import TecAvatar from "../../../assets/Tec_asistente.png";

interface Props {
    onClose: () => void;
}

/** Sugerencias iniciales propias del portal TECNOTICS. */
const SUGGESTIONS = [
    "¿Cómo emito una factura electrónica?",
    "¿Cómo causo una compra desde el XML de la DIAN?",
    "¿Cómo traigo mis facturas recibidas de la DIAN?",
    "¿Cómo inicializo la contabilidad y el PUC?",
];

const TecChat: React.FC<Props> = ({ onClose }) => {
    const [messages, setMessages] = useState<TecMessage[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);
    const [sendingEmailIdx, setSendingEmailIdx] = useState<number | null>(null);

    const endRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);
    useEffect(() => { inputRef.current?.focus(); }, []);

    const send = async (text: string) => {
        const trimmed = text.trim();
        if (!trimmed || loading) return;

        setMessages((prev) => [...prev, { role: "user", content: trimmed, timestamp: new Date().toISOString() }]);
        setInput("");
        setLoading(true);
        try {
            const data = await sendTecMessage(trimmed, conversationId);
            setConversationId(data.conversationId);
            setMessages((prev) => [...prev, { role: "assistant", content: data.reply, timestamp: new Date().toISOString() }]);
        } catch (error) {
            setMessages((prev) => prev.slice(0, -1)); // revierte el mensaje del usuario
            if (isTecUnavailable(error)) errorToast("El asistente TEC no está disponible en este momento.");
            else errorToast(error instanceof Error ? error.message : "No pude responderte ahora. Intenta de nuevo.");
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
    };

    const sendByEmail = async (idx: number) => {
        if (!conversationId || sendingEmailIdx !== null) return;
        setSendingEmailIdx(idx);
        try {
            const { email } = await sendTecByEmail(conversationId, idx);
            successToast(`✉️ Enviado a ${email}`);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No pude enviar el correo. Intenta de nuevo.");
        } finally {
            setSendingEmailIdx(null);
        }
    };

    const newChat = () => {
        setMessages([]);
        setConversationId(null);
        setInput("");
        inputRef.current?.focus();
    };

    return (
        <>
            <div className="tec-header">
                {avatarFailed
                    ? <div className="tec-header__avatar tec-header__avatar--fallback">🤖</div>
                    : <img src={TecAvatar} alt="TEC" className="tec-header__avatar" onError={() => setAvatarFailed(true)} />}
                <div className="tec-header__title">
                    <span className="tec-header__name">TEC</span>
                    <span className="tec-header__status">Asistente de TECNOTICS</span>
                </div>
                <div className="tec-header__actions">
                    <button className="tec-header__btn" onClick={newChat} title="Nueva conversación" aria-label="Nueva conversación"><i className="ri-refresh-line" /></button>
                    <button className="tec-header__btn" onClick={onClose} title="Cerrar" aria-label="Cerrar"><i className="ri-close-line" /></button>
                </div>
            </div>

            <div className="tec-messages">
                {messages.length === 0 && !loading && (
                    <div className="tec-empty">
                        {!avatarFailed && <img src={TecAvatar} alt="TEC" className="tec-empty__hero" onError={() => setAvatarFailed(true)} />}
                        <h2 className="tec-empty__title">¡Hola, soy TEC! 👋</h2>
                        <p className="tec-empty__subtitle">Tu asistente del portal TECNOTICS</p>
                        <p className="tec-empty__lead">¿En qué te puedo ayudar hoy? Resuelvo tus dudas sobre el uso de la plataforma.</p>
                        <div className="tec-empty__suggestions">
                            {SUGGESTIONS.map((s) => (
                                <button key={s} className="tec-empty__suggestion" onClick={() => send(s)}>{s}</button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map((m, i) => (
                    <TecMessageBubble
                        key={i}
                        message={m}
                        canSendByEmail={!!conversationId && m.role === "assistant"}
                        isSendingByEmail={sendingEmailIdx === i}
                        onSendByEmail={() => sendByEmail(i)}
                    />
                ))}

                {loading && (
                    <div className="tec-typing"><span className="tec-typing__dot" /><span className="tec-typing__dot" /><span className="tec-typing__dot" /></div>
                )}
                <div ref={endRef} />
            </div>

            <div className="tec-input">
                <textarea
                    ref={inputRef}
                    className="tec-input__field"
                    placeholder="Escribe tu pregunta..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    rows={1}
                    disabled={loading}
                    maxLength={2000}
                />
                <button className="tec-input__send" onClick={() => send(input)} disabled={loading || !input.trim()} title="Enviar" aria-label="Enviar">
                    <i className="ri-send-plane-2-fill" />
                </button>
            </div>
            <div className="tec-disclaimer">TEC puede equivocarse. Verifica datos críticos.</div>
        </>
    );
};

export default TecChat;
