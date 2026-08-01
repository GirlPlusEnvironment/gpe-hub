import{s as i,r as _,t as u,v as c}from"./index-BcU8tJrp.js";function p(e){return{success:!1,message:e,reason:"rpc_error",pointsAwarded:0,pointsRequested:0,dailyLimitReached:!1,transactionId:null}}function f(e,t){var a,s,n,l;let o,r=null;if(e.type==="poll"&&e.poll_options&&(o=e.poll_options.map(d=>({id:d.id,post_id:e.id,option_text:d.option_text,votes_count:d.poll_votes?d.poll_votes.length:0})),t)){for(const d of e.poll_options)if((a=d.poll_votes)!=null&&a.some(m=>m.user_id===t)){r=d.id;break}}return{...e,user:e.user??void 0,likes_count:e.post_likes?e.post_likes.length:0,comments_count:((n=(s=e.post_comments)==null?void 0:s[0])==null?void 0:n.count)??0,has_liked:t?!!((l=e.post_likes)!=null&&l.some(d=>d.user_id===t)):!1,poll_options:o,user_vote_option_id:r}}async function h(){let e,t;const o=await i.from("posts").select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      ),
      post_likes (user_id),
      post_comments (count),
      poll_options (
        id,
        option_text,
        poll_votes (user_id)
      )
    `).eq("is_removed",!1).eq("is_hidden",!1).order("created_at",{ascending:!1});if(o.error&&o.error.message.includes("poll_options")){const s=await i.from("posts").select(`
        *,
        user:user_id (
          username,
          full_name,
          avatar_url
        ),
        post_likes (user_id),
        post_comments (count)
      `).eq("is_removed",!1).eq("is_hidden",!1).order("created_at",{ascending:!1});e=s.data,t=s.error}else e=o.data,t=o.error;if(t)throw t;const{data:{user:r}}=await i.auth.getUser(),a=r==null?void 0:r.id;return(e??[]).map(s=>f(s,a))}async function g(e){let t,o;const r=await i.from("posts").select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      ),
      post_likes (user_id),
      post_comments (count),
      poll_options (
        id,
        option_text,
        poll_votes (user_id)
      )
    `).eq("id",e).eq("is_removed",!1).eq("is_hidden",!1).single();if(r.error&&r.error.message.includes("poll_options")){const n=await i.from("posts").select(`
        *,
        user:user_id (
          username,
          full_name,
          avatar_url
        ),
        post_likes (user_id),
        post_comments (count)
      `).eq("id",e).eq("is_removed",!1).eq("is_hidden",!1).single();t=n.data,o=n.error}else t=r.data,o=r.error;if(o)throw o;const{data:{user:a}}=await i.auth.getUser(),s=a==null?void 0:a.id;return f(t,s)}async function v(e){const{data:{user:t}}=await i.auth.getUser();if(!t)throw new Error("Not authenticated");c(e.title),c(e.description),e.poll_options&&e.poll_options.forEach(s=>{c(s)});const{data:o,error:r}=await i.from("posts").insert({title:e.title,description:e.description,image_url:e.image_url,type:e.type||"text",user_id:t.id}).select().single();if(r)throw r;if(e.type==="poll"&&e.poll_options&&e.poll_options.length>0){const s=e.poll_options.map(l=>({post_id:o.id,option_text:l})),{error:n}=await i.from("poll_options").insert(s);n&&console.error("Failed to create poll options",n)}let a=null;try{a=await u(t.id,10,100,{actionType:"hub_post",source:"post_created",sourceId:o.id})}catch(s){console.error("Failed to award points for post creation",s),a=p(s instanceof Error?s.message:"Post was created, but points failed.")}return{...o,pointAward:a}}async function y(e,t){const{data:{user:o}}=await i.auth.getUser();if(!o)throw new Error("Not authenticated");const{data:r,error:a}=await i.from("poll_votes").select("id").eq("post_id",e).eq("user_id",o.id).maybeSingle();if(a)throw a;if(r)throw new Error("You have already voted on this poll");const{data:s,error:n}=await i.from("poll_votes").insert({post_id:e,poll_option_id:t,user_id:o.id}).select("id").single();if(n)throw n;try{return await u(o.id,1,100,{actionType:"hub_poll_vote",source:"poll_vote",sourceId:s.id,metadata:{post_id:e,option_id:t}})}catch(l){return console.error("Failed to award points for voting",l),p(l instanceof Error?l.message:"Vote was recorded, but points failed.")}}async function E(e,t){const{data:{user:o}}=await i.auth.getUser();if(!o)throw new Error("Not authenticated");if(t){const{error:r}=await i.from("post_likes").delete().eq("post_id",e).eq("user_id",o.id);if(r)throw r;try{await _(o.id,1)}catch(a){console.error("Failed to deduct points for post unlike",a)}}else{const{data:r,error:a}=await i.from("post_likes").insert({post_id:e,user_id:o.id}).select("id").single();if(a)throw a;try{return await u(o.id,1,100,{actionType:"hub_post_like",source:"post_like",sourceId:r.id,metadata:{post_id:e}})}catch(s){return console.error("Failed to award points for post like",s),p(s instanceof Error?s.message:"Like was saved, but points failed.")}}}async function q(e){const{data:t,error:o}=await i.from("post_comments").select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      )
    `).eq("post_id",e).eq("is_removed",!1).eq("is_hidden",!1).order("created_at",{ascending:!0});if(o)throw o;const r=new Map,a=[];return t.forEach(s=>{r.set(s.id,{...s,replies:[]})}),t.forEach(s=>{var n;if(s.parent_id){const l=r.get(s.parent_id);l&&((n=l.replies)==null||n.push(r.get(s.id)))}else a.push(r.get(s.id))}),a}async function k(e,t,o){const{data:{user:r}}=await i.auth.getUser();if(!r)throw new Error("Not authenticated");c(t);const{data:a,error:s}=await i.from("post_comments").insert({post_id:e,user_id:r.id,content:t,parent_id:o||null}).select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      )
    `).single();if(s)throw s;let n=null;try{n=await u(r.id,2,100,{actionType:"hub_comment",source:"post_comment",sourceId:a.id})}catch(l){console.error("Failed to award points for comment creation",l),n=p(l instanceof Error?l.message:"Comment was posted, but points failed.")}return{...a,pointAward:n}}async function b(e){const{data:{user:t}}=await i.auth.getUser();if(!t)throw new Error("Not authenticated");const{error:o}=await i.from("posts").delete().eq("id",e);if(o)throw o;try{await _(t.id,10)}catch(r){console.error("Failed to deduct points for post deletion",r)}}async function P(e,t){t.title&&c(t.title),t.description&&c(t.description);const{data:o,error:r}=await i.from("posts").update({...t,updated_at:new Date().toISOString()}).eq("id",e).select().single();if(r)throw r;return o}async function x(e){const{data:{user:t}}=await i.auth.getUser();if(!t)throw new Error("Not authenticated");const{error:o}=await i.from("post_comments").delete().eq("id",e);if(o)throw o;try{await _(t.id,2)}catch(r){console.error("Failed to deduct points for comment deletion",r)}}async function F(e,t){c(t);const{data:o,error:r}=await i.from("post_comments").update({content:t,updated_at:new Date().toISOString()}).eq("id",e).select().single();if(r)throw r;return o}export{g as a,q as b,v as c,x as d,k as e,h as f,P as g,b as h,E as t,F as u,y as v};
