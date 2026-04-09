import { CreateTaskForm } from "@/components/create-task-form";
import { TaskHistorySection } from "@/components/task-history-section";

export default function Home() {
  return (
    <main className="flex flex-col pb-14">
      <section className="section-shell pt-6 sm:pt-8">
        <div className="mx-auto max-w-[760px]">
          <CreateTaskForm />
        </div>
      </section>

      <section className="section-shell pt-8">
        <TaskHistorySection />
      </section>
    </main>
  );
}
