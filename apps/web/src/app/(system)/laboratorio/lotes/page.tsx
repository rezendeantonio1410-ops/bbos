import Link from "next/link";
import { Card } from "@bbos/ui";
export default function LabLotsPage() { return <div className="mx-auto max-w-[1200px]"><Link href="/laboratorio" className="text-xs font-bold text-forest-700">← Laboratório</Link><h1 className="mt-5 text-3xl font-bold">Amostras e lotes</h1><Card className="mt-6 p-8 text-center text-sm text-stone-500">A fila de amostras será alimentada pelos recebimentos vinculados a CoffeeLot.</Card></div>; }
