(function () {
  const yearNode = document.querySelector('[data-year]');
  if (yearNode) yearNode.textContent = new Date().getFullYear();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register((document.documentElement.dataset.base || '') + 'sw.js').catch(() => {});
    });
  }

  function slugify(value, fallback) {
    return (value || fallback || 'application')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || (fallback || 'application');
  }

  function downloadTextFile(name, content) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }

  function saveLocal(key, packet) {
    const current = JSON.parse(localStorage.getItem(key) || '[]');
    current.unshift(packet);
    localStorage.setItem(key, JSON.stringify(current.slice(0, 50)));
  }

  function installReset(buttonId, form, statusBox) {
    const resetBtn = document.getElementById(buttonId);
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        form.reset();
        statusBox.className = 'status-box';
        statusBox.innerHTML = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, { once: true });
    }
  }

  const cohortForm = document.getElementById('cohort-application-form');
  const cohortStatus = document.getElementById('application-status');

  if (cohortForm && cohortStatus) {
    function makeCohortPacket(data) {
      const stamp = new Date();
      const id = 'OS-' + stamp.getFullYear().toString().slice(-2) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      return {
        applicationId: id,
        submittedAt: stamp.toISOString(),
        cohort: '0s Founder Cohort',
        seatPrice: '$4,444',
        includesPlatformAccess: 'Yes',
        aiUsageDuringClass: 'Covered by Skyes Over London',
        ...data
      };
    }

    function cohortPacketText(packet) {
      return [
        '0s Founder Cohort Application',
        'Application ID: ' + packet.applicationId,
        'Submitted At: ' + packet.submittedAt,
        'Seat Price: ' + packet.seatPrice,
        '0s Access Included: ' + packet.includesPlatformAccess,
        'In-Class AI Usage: ' + packet.aiUsageDuringClass,
        '',
        'Full Name: ' + packet.fullName,
        'Email: ' + packet.email,
        'Phone: ' + packet.phone,
        'City/Region: ' + packet.location,
        'Installed 0s: ' + packet.installed0s,
        'Device: ' + packet.device,
        'Coding Experience: ' + packet.experience,
        'Weekly Availability: ' + packet.availability,
        '',
        'What They Want To Build:',
        packet.buildGoal,
        '',
        'Why This Cohort:',
        packet.why,
        '',
        'Commitment Confirmation:',
        packet.commitment,
        '',
        'Agreement:',
        packet.agreement
      ].join('\n');
    }

    cohortForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(cohortForm).entries());
      if (!data.fullName || !data.email || !data.buildGoal || !data.why || !data.commitment || !data.agreement) {
        cohortStatus.className = 'status-box show';
        cohortStatus.innerHTML = '<strong>Missing required details.</strong><p>Please complete all required fields before submitting.</p>';
        return;
      }

      const packet = makeCohortPacket(data);
      const content = cohortPacketText(packet);
      const filename = `${slugify(packet.fullName, 'cohort-application')}-0s-founder-cohort-application.txt`;

      try { saveLocal('osFounderCohortApplications', packet); } catch (_) {}
      try { await navigator.clipboard.writeText(content); } catch (_) {}
      downloadTextFile(filename, content);

      const subject = encodeURIComponent(`0s Founder Cohort Paid Seat Application — ${packet.fullName}`);
      const body = encodeURIComponent(content);
      const mailHref = `mailto:SkyesOverLondonLC@SOLEnterprises.org?cc=SkyesOverLondon@gmail.com,B2B@SOLEnterprises.org&subject=${subject}&body=${body}`;

      cohortStatus.className = 'status-box show';
      cohortStatus.innerHTML = `
        <strong>Application packet created.</strong>
        <p>Your application was saved in this browser, copied to your clipboard when available, and downloaded as a text file.</p>
        <p><strong>Important:</strong> Your cohort application is not fully submitted yet. After this packet is generated, you must press <strong>Open Email Draft</strong> and then send that email to complete your application.</p><p><strong>Seat note:</strong> This packet is for a <strong>$4,444 paid founder-cohort seat</strong>. Payment is handled after founder-side review and follow-up.</p>
        <p>Application ID: <strong>${packet.applicationId}</strong></p>
        <div class="inline-actions">
          <a class="button" href="${mailHref}">Open Email Draft</a>
          <button class="button secondary" type="button" id="reset-form-button">Start New Application</button>
        </div>
      `;

      installReset('reset-form-button', cohortForm, cohortStatus);
      cohortForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  const orgForm = document.getElementById('org-cohort-request-form');
  const orgStatus = document.getElementById('org-request-status');

  if (orgForm && orgStatus) {
    function makeOrgPacket(data) {
      const stamp = new Date();
      const id = 'ORG-' + stamp.getFullYear().toString().slice(-2) + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      return {
        requestId: id,
        submittedAt: stamp.toISOString(),
        program: 'Bring 0s Founder Cohort to Our Organization',
        approvalStatus: 'Open invitation only — subject to vetting and approval by SOLEnterprise (International Nexus & Holdings)',
        ...data
      };
    }

    function orgPacketText(packet) {
      return [
        'Organization Cohort Request',
        'Request ID: ' + packet.requestId,
        'Submitted At: ' + packet.submittedAt,
        'Program: ' + packet.program,
        'Approval Status: ' + packet.approvalStatus,
        '',
        'Organization: ' + packet.orgName,
        'Website: ' + packet.website,
        'Primary Contact: ' + packet.contactName,
        'Role/Title: ' + packet.role,
        'Email: ' + packet.email,
        'Phone: ' + packet.phone,
        'City / State: ' + packet.location,
        'Youth / Participant Group: ' + packet.audience,
        'Preferred Launch Window: ' + packet.launchWindow,
        'On-Site Space / Lab / Resource Room: ' + packet.space,
        '',
        'Why This Organization Wants A Cohort:',
        packet.why,
        '',
        'What Outcomes They Want For Participants:',
        packet.outcomes,
        '',
        'What Support They Need From SOLEnterprise:',
        packet.support,
        '',
        'Approval Acknowledgement:',
        packet.acknowledgement,
        '',
        'Org Agreement:',
        packet.agreement
      ].join('\n');
    }

    orgForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(orgForm).entries());
      if (!data.orgName || !data.contactName || !data.email || !data.why || !data.outcomes || !data.acknowledgement || !data.agreement) {
        orgStatus.className = 'status-box show';
        orgStatus.innerHTML = '<strong>Missing required details.</strong><p>Please complete all required organization fields before submitting.</p>';
        return;
      }

      const packet = makeOrgPacket(data);
      const content = orgPacketText(packet);
      const filename = `${slugify(packet.orgName, 'organization-request')}-organization-cohort-request.txt`;

      try { saveLocal('osFounderCohortOrganizationRequests', packet); } catch (_) {}
      try { await navigator.clipboard.writeText(content); } catch (_) {}
      downloadTextFile(filename, content);

      const subject = encodeURIComponent(`Organization Cohort Request — ${packet.orgName}`);
      const body = encodeURIComponent(content);
      const mailHref = `mailto:SkyesOverLondonLC@SOLEnterprises.org?cc=SkyesOverLondon@gmail.com,B2B@SOLEnterprises.org&subject=${subject}&body=${body}`;

      orgStatus.className = 'status-box show';
      orgStatus.innerHTML = `
        <strong>Organization request packet created.</strong>
        <p>Your organization request was saved in this browser, copied to your clipboard when available, and downloaded as a text file.</p>
        <p><strong>Important:</strong> This request is not submitted until you press <strong>Open Email Draft</strong> and send the email. Submission does <strong>not</strong> mean automatic acceptance. Every organization is vetted and remains subject to approval by <strong>SOLEnterprise (International Nexus &amp; Holdings)</strong>.</p>
        <p>Request ID: <strong>${packet.requestId}</strong></p>
        <div class="inline-actions">
          <a class="button" href="${mailHref}">Open Email Draft</a>
          <button class="button secondary" type="button" id="reset-org-form-button">Start New Organization Request</button>
        </div>
      `;

      installReset('reset-org-form-button', orgForm, orgStatus);
      orgForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
})();
