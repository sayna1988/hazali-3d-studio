interface Props {

  title:string;

  value:string;

  icon:any;

}

export default function StatCard({

  title,

  value,

  icon:Icon

}:Props){

  return(

    <div className="stat-card">

      <div className="stat-icon">

        <Icon size={22}/>

      </div>

      <div className="stat-card-title">

        {title}

      </div>

      <div className="stat-card-value">

        {value}

      </div>

      <div className="stat-growth">

        ↑ + deze week

      </div>

    </div>

  );

}