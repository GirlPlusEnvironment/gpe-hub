import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="border-t-[3px] border-black bg-white md:pl-[304px]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 md:flex-row md:items-end md:justify-between md:px-8">
        <div>
          <img
            src="/logo.png"
            alt="GPE Hub"
            className="h-auto w-full max-w-[180px] object-contain"
          />
          <p className="mt-2 max-w-xl text-sm text-black/70">
            A shared space for environmental justice jobs, events, funding, resources,
            community conversations, and member connections.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-bold uppercase">
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
