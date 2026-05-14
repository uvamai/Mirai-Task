import {
  sequelize,
  Tenant,
  Project,
  TenantSubscription,
  SubscriptionPlan,
} from "./models";

async function run() {
  try {
    await sequelize.authenticate();
    const t = await Tenant.findOne();
    if (!t) {
      process.exit(0);
    }

    const projCount = await Project.count({ where: { tenantId: t.id } });
    console.log(`Tenant '${t.name}' currently has ${projCount} projects.`);

    const sub = await TenantSubscription.findOne({
      where: { tenantId: t.id },
      order: [["createdAt", "DESC"]],
    });
    if (sub) {
      console.log(
        `Subscription ID: ${sub.id}, Plan ID: ${sub.planId}, Status: ${sub.status}`,
      );
      const plan = await SubscriptionPlan.findByPk(sub.planId);
      if (plan) {
        console.log(
          `Plan Name: ${plan.name}, Max Projects: ${plan.maxProjects}`,
        );
        if (plan.maxProjects < 100) {
          console.log("Increasing Max Projects to 100 for smooth testing...");
          plan.maxProjects = 100;
          await plan.save();
          console.log("Plan limits successfully upgraded!");
        }
      }
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
