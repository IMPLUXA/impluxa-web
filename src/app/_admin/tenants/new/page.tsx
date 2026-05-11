import { CreateTenantForm } from "@/components/admin/CreateTenantForm";

export default function NewTenant() {
  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Nuevo tenant</h1>
      <CreateTenantForm />
    </div>
  );
}
