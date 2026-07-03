import { API_ROUTES } from "../../../utils/global";

export interface Attachment {
    _id: string;
    company_id: string;
    entidad: string;
    entidad_id: string;
    nombre: string;
    url: string;
    public_id: string;
    mime?: string;
    tamano?: number;
    subido_por?: string;
    createdAt?: string;
}

export const listAttachments = async (entidad: string, entidadId: string): Promise<Attachment[]> => {
    const res = await fetch(API_ROUTES.ATTACHMENTS(entidad, entidadId), { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error al listar adjuntos");
    return data;
};

export const uploadAttachment = async (entidad: string, entidadId: string, file: File): Promise<Attachment> => {
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch(API_ROUTES.ATTACHMENTS(entidad, entidadId), { method: "POST", credentials: "include", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "No se pudo subir el adjunto");
    return data;
};

export const deleteAttachment = async (id: string): Promise<{ ok: boolean }> => {
    const res = await fetch(API_ROUTES.ATTACHMENT_BY_ID(id), { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "No se pudo eliminar el adjunto");
    return data;
};
