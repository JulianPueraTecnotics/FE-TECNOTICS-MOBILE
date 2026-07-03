import { useState } from "react";
import Navbar from "./navbar/Navbar";
import Sidebar from "./sidebar/Siderbar";

/** Layout desktop del portal (Navbar + Sidebar). */
const PortalWebShell: React.FC = () => {
  const [open, setOpen] = useState(false);

  const handleOpenSidebar = () => {
    setOpen((prev) => !prev);
  };

  return (
    <>
      <Navbar open_sidebar={open} setOpenSidebar={handleOpenSidebar} />
      <Sidebar is_open={open} open_sidebar={handleOpenSidebar} />
    </>
  );
};

export default PortalWebShell;
