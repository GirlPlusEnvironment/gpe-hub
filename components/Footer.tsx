import { Link } from "react-router-dom";

const Footer = () => {
  return (
    <footer className="w-full max-w-full overflow-x-hidden border-t-[4px] border-black bg-gpe-pink text-black md:pl-[304px]">
      <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-8 px-3 py-10 sm:px-4 md:flex-row md:items-end md:justify-between md:px-8">
        <div className="gpe-card-sm min-w-0 bg-white p-5">
          <img
            src="/logo.png"
            alt="GPE Hub"
            className="h-auto w-full max-w-[180px] object-contain"
          />
          <p className="mt-3 max-w-xl break-words text-sm font-bold text-black/70">
            A playful mission board for environmental justice opportunities, seasonal challenges,
            community conversations, and member connection.
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap gap-3 text-sm font-bold uppercase">
          <Link className="gpe-pill bg-gpe-yellow px-4 py-2" to="/explore">
            Explore
          </Link>
          <Link className="gpe-pill bg-gpe-cyan px-4 py-2" to="/community">
            Community
          </Link>
          <Link className="gpe-pill bg-white px-4 py-2" to="/camp-gpe/challenges">
            Camp
          </Link>
          <Link className="gpe-pill bg-black px-4 py-2 text-white" to="/submit">
            Submit
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
