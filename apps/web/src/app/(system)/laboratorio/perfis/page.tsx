import Link from "next/link";
import { Card } from "@bbos/ui";
export default function LabProfilesPage() { return <div className="mx-auto max-w-[1200px]"><Link href="/laboratorio" className="text-xs font-bold text-forest-700">← Laboratório</Link><h1 className="mt-5 text-3xl font-bold">Perfis sensoriais</h1><Card className="mt-6 p-8 text-center text-sm text-stone-500">Perfis históricos aparecerão após a consolidação de sessões.</Card></div>; }
