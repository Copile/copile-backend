async function findAndSyncUsers(groupId, planId, planName) {
  console.log("--- STARTING FIND AND SYNC USERS ---");

  console.log(`Starting findAndSyncUsers for groupId: ${groupId} and planId: ${planId}`);
  try {
    // Fetch the plan document
    const groupDocRef = db.collection("groups").doc(groupId);
    const planDocRef = groupDocRef.collection("plans").doc(planId);
    const planDoc = await planDocRef.get();

    if (!planDoc.exists) {
      console.log(`Plan with id: ${planId} in group: ${groupId} not found.`);
      return;
    }

    // Get the workers in the plan
    const planWorkersRef = planDocRef.collection("assigned_workers");
    const planWorkersSnapshot = await planWorkersRef.get();
    const planWorkers = planWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Fetched ${planWorkers.length} workers for planId: ${planId}`);

    // Fetch all memberships from Whop
    const response = await axios.get(
      `https://api.whop.com/v2/memberships?plan_id=${planId}&expand=[plan]&per=50`,
      {
        headers: {
          Authorization: "Bearer WRVpaQ7IWf_etpDswHmn0jPRJjuzBd2PGQEMPdUIFf4",
        },
      }
    );
    console.log(`Fetched ${response.data.data.length} memberships for planId: ${planId}`);

    // For each membership
    for (const membership of response.data.data) {
      // Construct request body for /createLicense endpoint
      const requestBody = {
        userId: membership.user,
        planId: planId,
        groupId: groupId,
        planName: planName,
      };

      const response = syncUser(requestBody, planWorkers);

      if (response.success) {
        console.log(`Successfully synced user ${membership.user}`);
      }

      // Wait 1s before doing next membership just incase it blows up
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("--- FINISHED FIND AND SYNC USERS ---");
  } catch (error) {
    console.error(`Error in findAndSyncUsers for groupId: ${groupId} and planId: ${planId}`, error);
  }
}

const syncUser = async (data, planWorkers) => {
  const { userId, planId, groupId, planName } = data;
  console.log(`Starting syncUser for userId: ${userId}, planId: ${planId}, and groupId: ${groupId}`);

  try {
    // Get the user's plan document reference
    const userPlanDocRef = db.collection(`users/${userId}/plans`).doc(planId);

    // Fetch the user's plan document
    const userPlanDoc = await userPlanDocRef.get();

    if (!userPlanDoc.exists) {
      console.log(`User's plan with id: ${planId} for userId: ${userId} not found.`);
      return { success: false, error: "User's plan not found" };
    }

    // Get the workers in the user's plan
    const userPlanWorkersRef = userPlanDocRef.collection("workers");
    const userPlanWorkersSnapshot = await userPlanWorkersRef.get();
    const userPlanWorkers = userPlanWorkersSnapshot.docs.map((doc) => doc.data());
    console.log(`Fetched ${userPlanWorkers.length} workers for userId: ${userId} and planId: ${planId}`);

    // For each worker in the plan
    for (const worker of planWorkers) {
      // If the worker is not in the user's plan, add it
      if (!userPlanWorkers.some((userPlanWorker) => userPlanWorker.id === worker.id)) {
        const workerDataForUserPlan = {
          id: worker.id,
          name: worker.name,
          enabled: false,
          margin: "x",
          percentage: "x",
          option: "x",
          preferred_exchange: "x",
          plan_id: planId,
          plan_name: planName,
        };
        await userPlanWorkersRef.doc(worker.id).set(workerDataForUserPlan);
        console.log(`Added worker ${worker.id} to userId: ${userId} and planId: ${planId}`);
      }
    }

    // For each worker in the user's plan
    for (const worker of userPlanWorkers) {
      // If the worker is not in the plan, remove it
      if (!planWorkers.some((planWorker) => planWorker.id === worker.id)) {
        await userPlanWorkersRef.doc(worker.id).delete();
        console.log(`Removed worker ${worker.id} from userId: ${userId} and planId: ${planId}`);
      }
    }

    return { success: true };
  } catch (error) {
    console.error(`Error in syncUser for userId: ${userId}, planId: ${planId}, and groupId: ${groupId}`, error);
    return { success: false, error: error.message };
  }
};

module.exports = { findAndSyncUsers };
