import { useParams } from "react-router-dom";

export default function TokenPage() {
  const { address } = useParams();

  return (
    <div className="p-6 text-white">

      <h1 className="text-2xl font-bold mb-4">
        Token Page
      </h1>

      <div className="bg-slate-900 p-6 rounded-lg border border-slate-800">

        <p className="text-slate-400 text-sm mb-2">
          Token Address
        </p>

        <p className="break-all text-purple-400">
          {address}
        </p>

      </div>

    </div>
  );
}
