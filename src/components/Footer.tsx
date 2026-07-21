import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="w-full max-w-full overflow-x-hidden border-t-[3px] border-black bg-white md:pl-[304px]">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 px-3 py-8 sm:px-4 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="min-w-0">
          <img
            src="/logo.png"
            alt="GPE Hub"
            className="h-auto w-full max-w-[180px] object-contain"
          />
          <p className="mt-2 max-w-xl break-words text-sm text-black/70">
            A shared space for environmental justice jobs, events, funding, resources,
            community conversations, and member connections.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3 text-sm font-bold uppercase">
          <Link className="gpe-pill px-4 py-2" to="/explore">
            Explore
          </Link>
          <Link className="gpe-pill px-4 py-2" to="/community">
            Community
          </Link>
          <Link className="gpe-pill px-4 py-2" to="/submit">
            Submit
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
