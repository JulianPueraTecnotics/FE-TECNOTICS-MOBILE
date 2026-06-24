import toast, { Toaster } from "react-hot-toast";

export const successToast = (message: string) => {
    toast.success(message);
}

export const errorToast = (message: string) => {
    toast.error(message);
}

export const loadingToast = (message: string) => {
    toast.loading(message);
}

export const ToastComponent = () => {
    return (
        <Toaster
            position="bottom-right"
        />
    );
};
